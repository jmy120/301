package com.example.sysmlmodelchecker.service.validation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 极简 JavaScript 子集解释器，用于执行规则库中的求解脚本。
 *
 * <p>Java 17 不再内置 Nashorn，项目也不引入额外 JS 引擎依赖，因此实现一个覆盖
 * 现有规则脚本语法的最小解释器。支持：function main(element, context){}、var、
 * if/else、for、return、三元表达式、[]/./下标访问、数组与字符串/数字/布尔/null
 * 字面量，运算符 == != === !== &amp;&amp; || ! &lt; &gt; &lt;= &gt;= + - * / % ++，
 * 以及 .length 与 .trim() 等字符串方法。</p>
 */
public class RuleScriptEngine {

    /** 脚本语法或运行时错误 */
    public static class ScriptException extends RuntimeException {
        public ScriptException(String message) {
            super(message);
        }
    }

    /**
     * 执行规则脚本：解析后调用 main(element, context)，返回其返回值（通常为 Boolean）。
     *
     * @param script  规则库中的 script 字段
     * @param element 当前被检测对象（已绑定为属性 Map）
     * @param context 上下文（elements/relations/diagrams/views 等）
     */
    public Object execute(String script, Map<String, Object> element, Map<String, Object> context) {
        if (script == null || script.isBlank()) {
            throw new IllegalArgumentException("规则脚本为空");
        }
        List<Token> tokens = new Lexer(script).tokenize();
        List<Stmt> program = new Parser(tokens).parseProgram();
        Env env = new Env(null);
        Interpreter interpreter = new Interpreter();
        for (Stmt stmt : program) {
            interpreter.exec(stmt, env);
        }
        Object fn = env.get("main");
        if (!(fn instanceof FunctionValue function)) {
            throw new IllegalArgumentException("脚本中未找到 main(element[, context]) 函数");
        }
        List<Object> args = new ArrayList<>();
        args.add(element);
        args.add(context);
        return interpreter.call(function, args);
    }

    // ================= AST =================

    private sealed interface Expr permits Literal, VarExpr, MemberExpr, IndexExpr, CallExpr,
            UnaryExpr, BinaryExpr, LogicalExpr, TernaryExpr, AssignExpr, PostfixExpr, ArrayExpr {
    }

    private record Literal(Object value) implements Expr {
    }

    private record VarExpr(String name) implements Expr {
    }

    private record MemberExpr(Expr target, String name) implements Expr {
    }

    private record IndexExpr(Expr target, Expr index) implements Expr {
    }

    private record CallExpr(Expr target, List<Expr> args) implements Expr {
    }

    private record UnaryExpr(String op, Expr operand) implements Expr {
    }

    private record BinaryExpr(String op, Expr left, Expr right) implements Expr {
    }

    private record LogicalExpr(String op, Expr left, Expr right) implements Expr {
    }

    private record TernaryExpr(Expr cond, Expr thenExpr, Expr elseExpr) implements Expr {
    }

    private record AssignExpr(String name, Expr value) implements Expr {
    }

    private record PostfixExpr(String name) implements Expr {
    }

    private record ArrayExpr(List<Expr> items) implements Expr {
    }

    private sealed interface Stmt permits VarDeclStmt, ExprStmt, IfStmt, ForStmt, ReturnStmt,
            ContinueStmt, BreakStmt, BlockStmt, FunctionDeclStmt {
    }

    private record VarDeclStmt(String name, Expr init) implements Stmt {
    }

    private record ExprStmt(Expr expr) implements Stmt {
    }

    private record IfStmt(Expr cond, Stmt thenStmt, Stmt elseStmt) implements Stmt {
    }

    private record ForStmt(String varName, Expr init, Expr cond, Expr update, Stmt body) implements Stmt {
    }

    private record ReturnStmt(Expr value) implements Stmt {
    }

    private record ContinueStmt() implements Stmt {
    }

    private record BreakStmt() implements Stmt {
    }

    private record BlockStmt(List<Stmt> body) implements Stmt {
    }

    private record FunctionDeclStmt(String name, List<String> params, List<Stmt> body) implements Stmt {
    }

    // ================= 词法分析 =================

    private static final class Token {
        enum Kind { IDENT, NUMBER, STRING, PUNCT, EOF }

        final Kind kind;
        final String text;
        final String stringValue;

        Token(Kind kind, String text, String stringValue) {
            this.kind = kind;
            this.text = text;
            this.stringValue = stringValue;
        }

        boolean is(String s) {
            if (kind == Kind.PUNCT || kind == Kind.IDENT) {
                return text.equals(s);
            }
            return false;
        }

        boolean isIdent() {
            return kind == Kind.IDENT;
        }

        boolean isEof() {
            return kind == Kind.EOF;
        }

        @Override
        public String toString() {
            return kind + "(" + text + ")";
        }
    }

    private static final class Lexer {
        private final String src;
        private int pos;

        Lexer(String src) {
            this.src = src;
        }

        List<Token> tokenize() {
            List<Token> out = new ArrayList<>();
            while (pos < src.length()) {
                char c = src.charAt(pos);
                if (Character.isWhitespace(c)) {
                    pos++;
                    continue;
                }
                if (c == '/' && pos + 1 < src.length() && src.charAt(pos + 1) == '/') {
                    while (pos < src.length() && src.charAt(pos) != '\n') {
                        pos++;
                    }
                    continue;
                }
                if (c == '/' && pos + 1 < src.length() && src.charAt(pos + 1) == '*') {
                    pos += 2;
                    while (pos + 1 < src.length() && !(src.charAt(pos) == '*' && src.charAt(pos + 1) == '/')) {
                        pos++;
                    }
                    pos = Math.min(pos + 2, src.length());
                    continue;
                }
                if (c == '"' || c == '\'') {
                    out.add(readString(c));
                    continue;
                }
                if (Character.isDigit(c)) {
                    out.add(readNumber());
                    continue;
                }
                if (Character.isLetter(c) || c == '_' || c == '$') {
                    out.add(readIdent());
                    continue;
                }
                if (pos + 2 < src.length()) {
                    String three = src.substring(pos, pos + 3);
                    if (three.equals("===") || three.equals("!==")) {
                        out.add(new Token(Token.Kind.PUNCT, three, null));
                        pos += 3;
                        continue;
                    }
                }
                if (pos + 1 < src.length()) {
                    String two = src.substring(pos, pos + 2);
                    if (two.equals("==") || two.equals("!=") || two.equals("<=") || two.equals(">=")
                            || two.equals("&&") || two.equals("||") || two.equals("++") || two.equals("--")) {
                        out.add(new Token(Token.Kind.PUNCT, two, null));
                        pos += 2;
                        continue;
                    }
                }
                if ("{}()[];,.<>+-*/%!?=:".indexOf(c) >= 0) {
                    out.add(new Token(Token.Kind.PUNCT, String.valueOf(c), null));
                    pos++;
                    continue;
                }
                throw new ScriptException("无法识别的字符: '" + c + "'");
            }
            out.add(new Token(Token.Kind.EOF, "", null));
            return out;
        }

        private Token readIdent() {
            int start = pos;
            while (pos < src.length() && (Character.isLetterOrDigit(src.charAt(pos))
                    || src.charAt(pos) == '_' || src.charAt(pos) == '$')) {
                pos++;
            }
            return new Token(Token.Kind.IDENT, src.substring(start, pos), null);
        }

        private Token readNumber() {
            int start = pos;
            boolean isDouble = false;
            while (pos < src.length() && (Character.isDigit(src.charAt(pos)) || src.charAt(pos) == '.')) {
                if (src.charAt(pos) == '.') {
                    isDouble = true;
                }
                pos++;
            }
            String text = src.substring(start, pos);
            Object value = isDouble ? Double.parseDouble(text) : Long.parseLong(text);
            return new Token(Token.Kind.NUMBER, text, value.toString());
        }

        private Token readString(char quote) {
            pos++;
            StringBuilder sb = new StringBuilder();
            while (pos < src.length()) {
                char c = src.charAt(pos);
                if (c == quote) {
                    pos++;
                    return new Token(Token.Kind.STRING, sb.toString(), sb.toString());
                }
                if (c == '\\' && pos + 1 < src.length()) {
                    char n = src.charAt(pos + 1);
                    switch (n) {
                        case 'n' -> sb.append('\n');
                        case 't' -> sb.append('\t');
                        case 'r' -> sb.append('\r');
                        case '\\' -> sb.append('\\');
                        case '"' -> sb.append('"');
                        case '\'' -> sb.append('\'');
                        default -> sb.append(n);
                    }
                    pos += 2;
                    continue;
                }
                sb.append(c);
                pos++;
            }
            throw new ScriptException("字符串未闭合");
        }
    }
    // ================= 语法分析 =================

    private static final class Parser {
        private final List<Token> tokens;
        private int pos;

        Parser(List<Token> tokens) {
            this.tokens = tokens;
        }

        List<Stmt> parseProgram() {
            List<Stmt> out = new ArrayList<>();
            while (!peek().isEof()) {
                out.add(parseStmt());
            }
            return out;
        }

        private Stmt parseStmt() {
            Token t = peek();
            if (t.is("var")) {
                return parseVarDecl();
            }
            if (t.is("function")) {
                return parseFunctionDecl();
            }
            if (t.is("if")) {
                return parseIf();
            }
            if (t.is("for")) {
                return parseFor();
            }
            if (t.is("return")) {
                return parseReturn();
            }
            if (t.is("{")) {
                return new BlockStmt(parseBlock());
            }
            if (t.is("continue")) {
                expect("continue");
                expect(";");
                return new ContinueStmt();
            }
            if (t.is("break")) {
                expect("break");
                expect(";");
                return new BreakStmt();
            }
            Expr expr = parseExpr();
            expect(";");
            return new ExprStmt(expr);
        }

        private VarDeclStmt parseVarDecl() {
            expect("var");
            String name = expectIdent();
            Expr init = null;
            if (match("=")) {
                init = parseExpr();
            }
            expect(";");
            return new VarDeclStmt(name, init);
        }

        private FunctionDeclStmt parseFunctionDecl() {
            expect("function");
            String name = expectIdent();
            expect("(");
            List<String> params = new ArrayList<>();
            if (!match(")")) {
                do {
                    params.add(expectIdent());
                } while (match(","));
                expect(")");
            }
            expect("{");
            List<Stmt> body = parseBlockBody();
            return new FunctionDeclStmt(name, params, body);
        }

        private IfStmt parseIf() {
            expect("if");
            expect("(");
            Expr cond = parseExpr();
            expect(")");
            Stmt thenStmt = parseStmt();
            Stmt elseStmt = null;
            if (match("else")) {
                elseStmt = parseStmt();
            }
            return new IfStmt(cond, thenStmt, elseStmt);
        }

        private ForStmt parseFor() {
            expect("for");
            expect("(");
            expect("var");
            String varName = expectIdent();
            expect("=");
            Expr init = parseExpr();
            expect(";");
            Expr cond = parseExpr();
            expect(";");
            Expr update = parseExpr();
            expect(")");
            Stmt body = parseStmt();
            return new ForStmt(varName, init, cond, update, body);
        }

        private ReturnStmt parseReturn() {
            expect("return");
            Expr value = null;
            if (!peek().is(";")) {
                value = parseExpr();
            }
            expect(";");
            return new ReturnStmt(value);
        }

        private List<Stmt> parseBlockBody() {
            List<Stmt> body = new ArrayList<>();
            while (!peek().isEof() && !peek().is("}")) {
                body.add(parseStmt());
            }
            expect("}");
            return body;
        }

        private List<Stmt> parseBlock() {
            expect("{");
            return parseBlockBody();
        }

        // ---------- 表达式（按优先级） ----------

        private Expr parseExpr() {
            return parseAssignment();
        }

        private Expr parseAssignment() {
            if (peek().isIdent()) {
                if (peekNext().is("=")) {
                    String name = expectIdent();
                    expect("=");
                    Expr value = parseAssignment();
                    return new AssignExpr(name, value);
                }
                String op = peekNext().text;
                if ((op.equals("+") || op.equals("-") || op.equals("*") || op.equals("/") || op.equals("%"))
                        && peekNext2().is("=")) {
                    String name = expectIdent();
                    consume();
                    expect("=");
                    Expr value = parseAssignment();
                    return new AssignExpr(name, new BinaryExpr(op, new VarExpr(name), value));
                }
            }
            return parseTernary();
        }

        private Expr parseTernary() {
            Expr cond = parseLogicalOr();
            if (match("?")) {
                Expr thenExpr = parseTernary();
                expect(":");
                Expr elseExpr = parseTernary();
                return new TernaryExpr(cond, thenExpr, elseExpr);
            }
            return cond;
        }

        private Expr parseLogicalOr() {
            Expr left = parseLogicalAnd();
            while (match("||")) {
                left = new LogicalExpr("||", left, parseLogicalAnd());
            }
            return left;
        }

        private Expr parseLogicalAnd() {
            Expr left = parseEquality();
            while (match("&&")) {
                left = new LogicalExpr("&&", left, parseEquality());
            }
            return left;
        }

        private Expr parseEquality() {
            Expr left = parseRelational();
            while (peek().is("==") || peek().is("!=") || peek().is("===") || peek().is("!==")) {
                String op = consume().text;
                left = new BinaryExpr(op, left, parseRelational());
            }
            return left;
        }

        private Expr parseRelational() {
            Expr left = parseAdditive();
            while (peek().is("<") || peek().is(">") || peek().is("<=") || peek().is(">=")) {
                String op = consume().text;
                left = new BinaryExpr(op, left, parseAdditive());
            }
            return left;
        }

        private Expr parseAdditive() {
            Expr left = parseMultiplicative();
            while (peek().is("+") || peek().is("-")) {
                String op = consume().text;
                left = new BinaryExpr(op, left, parseMultiplicative());
            }
            return left;
        }

        private Expr parseMultiplicative() {
            Expr left = parseUnary();
            while (peek().is("*") || peek().is("/") || peek().is("%")) {
                String op = consume().text;
                left = new BinaryExpr(op, left, parseUnary());
            }
            return left;
        }

        private Expr parseUnary() {
            if (peek().is("!") || peek().is("-")) {
                String op = consume().text;
                return new UnaryExpr(op, parseUnary());
            }
            return parsePostfix();
        }

        private Expr parsePostfix() {
            Expr expr = parsePrimary();
            while (true) {
                if (match(".")) {
                    String name = expectIdent();
                    expr = new MemberExpr(expr, name);
                } else if (match("[")) {
                    Expr index = parseExpr();
                    expect("]");
                    expr = new IndexExpr(expr, index);
                } else if (match("(")) {
                    List<Expr> args = new ArrayList<>();
                    if (!match(")")) {
                        do {
                            args.add(parseExpr());
                        } while (match(","));
                        expect(")");
                    }
                    expr = new CallExpr(expr, args);
                } else if (peek().is("++") && expr instanceof VarExpr varExpr) {
                    consume();
                    expr = new PostfixExpr(varExpr.name());
                } else {
                    break;
                }
            }
            return expr;
        }

        private Expr parsePrimary() {
            Token t = consume();
            if (t.kind == Token.Kind.NUMBER) {
                return new Literal(parseNumber(t.text));
            }
            if (t.kind == Token.Kind.STRING) {
                return new Literal(t.stringValue);
            }
            if (t.isIdent()) {
                switch (t.text) {
                    case "true":
                        return new Literal(Boolean.TRUE);
                    case "false":
                        return new Literal(Boolean.FALSE);
                    case "null":
                    case "undefined":
                        return new Literal(null);
                    default:
                        return new VarExpr(t.text);
                }
            }
            if (t.is("(")) {
                Expr expr = parseExpr();
                expect(")");
                return expr;
            }
            if (t.is("[")) {
                List<Expr> items = new ArrayList<>();
                if (!match("]")) {
                    do {
                        items.add(parseExpr());
                    } while (match(","));
                    expect("]");
                }
                return new ArrayExpr(items);
            }
            throw new ScriptException("无法解析的语法: " + t);
        }

        private Object parseNumber(String text) {
            if (text.indexOf('.') >= 0) {
                return Double.parseDouble(text);
            }
            return Long.parseLong(text);
        }

        private Token peek() {
            return tokens.get(pos);
        }

        private Token peekNext() {
            return tokens.get(Math.min(pos + 1, tokens.size() - 1));
        }

        private Token peekNext2() {
            return tokens.get(Math.min(pos + 2, tokens.size() - 1));
        }

        private boolean match(String s) {
            if (peek().is(s)) {
                pos++;
                return true;
            }
            return false;
        }

        private Token consume() {
            Token t = tokens.get(pos);
            if (t.isEof()) {
                throw new ScriptException("脚本意外结束");
            }
            pos++;
            return t;
        }

        private void expect(String s) {
            if (!match(s)) {
                throw new ScriptException("期望 '" + s + "'，实际为: " + peek());
            }
        }

        private String expectIdent() {
            Token t = consume();
            if (!t.isIdent()) {
                throw new ScriptException("期望标识符，实际为: " + t);
            }
            return t.text;
        }
    }
    // ================= 运行时 =================

    private static final class Env {
        final Env parent;
        final Map<String, Object> values = new LinkedHashMap<>();

        Env(Env parent) {
            this.parent = parent;
        }

        Object get(String name) {
            for (Env e = this; e != null; e = e.parent) {
                if (e.values.containsKey(name)) {
                    return e.values.get(name);
                }
            }
            return null; // undefined/null 统一为 null
        }

        void set(String name, Object value) {
            for (Env e = this; e != null; e = e.parent) {
                if (e.values.containsKey(name)) {
                    e.values.put(name, value);
                    return;
                }
            }
            values.put(name, value);
        }

        void declare(String name, Object value) {
            values.put(name, value);
        }
    }

    private static final class FunctionValue {
        final String name;
        final List<String> params;
        final List<Stmt> body;
        final Env closure;

        FunctionValue(String name, List<String> params, List<Stmt> body, Env closure) {
            this.name = name;
            this.params = params;
            this.body = body;
            this.closure = closure;
        }
    }

    private static final class ReturnSignal extends RuntimeException {
        final Object value;

        ReturnSignal(Object value) {
            this.value = value;
        }
    }

    private static final class ContinueSignal extends RuntimeException {
    }

    private static final class BreakSignal extends RuntimeException {
    }

    private static final class Interpreter {

        Object exec(Stmt stmt, Env env) {
            if (stmt instanceof VarDeclStmt varDecl) {
                Object init = varDecl.init() != null ? eval(varDecl.init(), env) : null;
                env.declare(varDecl.name(), init);
            } else if (stmt instanceof ExprStmt exprStmt) {
                eval(exprStmt.expr(), env);
            } else if (stmt instanceof IfStmt ifStmt) {
                if (truthy(eval(ifStmt.cond(), env))) {
                    exec(ifStmt.thenStmt(), env);
                } else if (ifStmt.elseStmt() != null) {
                    exec(ifStmt.elseStmt(), env);
                }
            } else if (stmt instanceof ForStmt forStmt) {
                env.declare(forStmt.varName(), eval(forStmt.init(), env));
                while (truthy(eval(forStmt.cond(), env))) {
                    try {
                        exec(forStmt.body(), env);
                    } catch (BreakSignal signal) {
                        break;
                    } catch (ContinueSignal signal) {
                        // 跳过本次循环剩余部分
                    }
                    eval(forStmt.update(), env);
                }
            } else if (stmt instanceof ContinueStmt) {
                throw new ContinueSignal();
            } else if (stmt instanceof BreakStmt) {
                throw new BreakSignal();
            } else if (stmt instanceof ReturnStmt returnStmt) {
                Object value = returnStmt.value() != null ? eval(returnStmt.value(), env) : null;
                throw new ReturnSignal(value);
            } else if (stmt instanceof BlockStmt blockStmt) {
                for (Stmt s : blockStmt.body()) {
                    exec(s, env);
                }
            } else if (stmt instanceof FunctionDeclStmt functionDecl) {
                env.declare(functionDecl.name(),
                        new FunctionValue(functionDecl.name(), functionDecl.params(), functionDecl.body(), env));
            }
            return null;
        }

        Object call(FunctionValue fn, List<Object> args) {
            Env env = new Env(fn.closure);
            for (int i = 0; i < fn.params.size(); i++) {
                env.declare(fn.params.get(i), i < args.size() ? args.get(i) : null);
            }
            try {
                for (Stmt s : fn.body) {
                    exec(s, env);
                }
            } catch (ReturnSignal signal) {
                return signal.value;
            }
            return null;
        }

        Object eval(Expr expr, Env env) {
            if (expr instanceof Literal literal) {
                return literal.value();
            }
            if (expr instanceof VarExpr varExpr) {
                return env.get(varExpr.name());
            }
            if (expr instanceof MemberExpr member) {
                return memberValue(eval(member.target(), env), member.name());
            }
            if (expr instanceof IndexExpr indexExpr) {
                return indexValue(eval(indexExpr.target(), env), eval(indexExpr.index(), env));
            }
            if (expr instanceof CallExpr callExpr) {
                if (!(callExpr.target() instanceof MemberExpr memberExpr)) {
                    throw new ScriptException("仅支持对象方法调用，如 .trim()");
                }
                Object base = eval(memberExpr.target(), env);
                return callMethod(base, memberExpr.name(), callExpr.args(), env);
            }
            if (expr instanceof UnaryExpr unary) {
                Object value = eval(unary.operand(), env);
                if (unary.op().equals("!")) {
                    return !truthy(value);
                }
                if (unary.op().equals("-")) {
                    return -toNumber(value);
                }
                throw new ScriptException("不支持的运算符: " + unary.op());
            }
            if (expr instanceof BinaryExpr binary) {
                return applyBinary(binary.op(), eval(binary.left(), env), eval(binary.right(), env));
            }
            if (expr instanceof LogicalExpr logical) {
                Object left = eval(logical.left(), env);
                if (logical.op().equals("&&")) {
                    return truthy(left) ? eval(logical.right(), env) : left;
                }
                return truthy(left) ? left : eval(logical.right(), env);
            }
            if (expr instanceof TernaryExpr ternary) {
                return truthy(eval(ternary.cond(), env)) ? eval(ternary.thenExpr(), env) : eval(ternary.elseExpr(), env);
            }
            if (expr instanceof AssignExpr assign) {
                Object value = eval(assign.value(), env);
                env.set(assign.name(), value);
                return value;
            }
            if (expr instanceof PostfixExpr postfix) {
                Object old = env.get(postfix.name());
                Object value = toNumber(old) + 1;
                env.set(postfix.name(), value);
                return old;
            }
            if (expr instanceof ArrayExpr array) {
                List<Object> items = new ArrayList<>();
                for (Expr item : array.items()) {
                    items.add(eval(item, env));
                }
                return items;
            }
            throw new ScriptException("未知表达式: " + expr);
        }

        private Object memberValue(Object target, String name) {
            if (target == null) {
                return null;
            }
            if (target instanceof Map<?, ?> map) {
                return map.containsKey(name) ? map.get(name) : null;
            }
            if (target instanceof List<?> list) {
                return name.equals("length") ? (long) list.size() : null;
            }
            if (target instanceof String s) {
                return name.equals("length") ? (long) s.length() : null;
            }
            return null;
        }

        private Object indexValue(Object target, Object index) {
            if (target == null) {
                return null;
            }
            if (target instanceof List<?> list) {
                int i = (int) toLong(index);
                return i >= 0 && i < list.size() ? list.get(i) : null;
            }
            if (target instanceof Map<?, ?> map) {
                return map.get(String.valueOf(index));
            }
            if (target instanceof String s) {
                int i = (int) toLong(index);
                return i >= 0 && i < s.length() ? String.valueOf(s.charAt(i)) : null;
            }
            return null;
        }

        private Object callMethod(Object base, String method, List<Expr> args, Env env) {
            if (base instanceof String s) {
                if (method.equals("trim")) {
                    return s.trim();
                }
                if (method.equals("toLowerCase")) {
                    return s.toLowerCase(Locale.ROOT);
                }
                if (method.equals("toUpperCase")) {
                    return s.toUpperCase(Locale.ROOT);
                }
                if (method.equals("charAt")) {
                    int i = args.isEmpty() ? 0 : (int) toLong(eval(args.get(0), env));
                    return i >= 0 && i < s.length() ? String.valueOf(s.charAt(i)) : "";
                }
                if (method.equals("indexOf")) {
                    String sub = args.isEmpty() ? "" : toJsString(eval(args.get(0), env));
                    return (long) s.indexOf(sub);
                }
                if (method.equals("includes")) {
                    String sub = args.isEmpty() ? "" : toJsString(eval(args.get(0), env));
                    return s.contains(sub);
                }
                if (method.equals("startsWith")) {
                    String sub = args.isEmpty() ? "" : toJsString(eval(args.get(0), env));
                    return s.startsWith(sub);
                }
                if (method.equals("endsWith")) {
                    String sub = args.isEmpty() ? "" : toJsString(eval(args.get(0), env));
                    return s.endsWith(sub);
                }
                if (method.equals("split")) {
                    String sep = args.isEmpty() ? "" : toJsString(eval(args.get(0), env));
                    if (sep.isEmpty()) {
                        List<Object> chars = new ArrayList<>();
                        for (int i = 0; i < s.length(); i++) {
                            chars.add(String.valueOf(s.charAt(i)));
                        }
                        return chars;
                    }
                    String[] parts = s.split(java.util.regex.Pattern.quote(sep), -1);
                    List<Object> out = new ArrayList<>();
                    for (String part : parts) {
                        out.add(part);
                    }
                    return out;
                }
                throw new ScriptException("不支持的字符串方法: " + method);
            }
            throw new ScriptException("仅支持字符串方法调用，实际调用: " + method);
        }

        private Object applyBinary(String op, Object left, Object right) {
            switch (op) {
                case "+":
                    if (left instanceof String || right instanceof String) {
                        return toJsString(left) + toJsString(right);
                    }
                    return toNumber(left) + toNumber(right);
                case "-":
                    return toNumber(left) - toNumber(right);
                case "*":
                    return toNumber(left) * toNumber(right);
                case "/":
                    return toNumber(left) / toNumber(right);
                case "%":
                    return toNumber(left) % toNumber(right);
                case "<":
                    return compare(left, right) < 0;
                case ">":
                    return compare(left, right) > 0;
                case "<=":
                    return compare(left, right) <= 0;
                case ">=":
                    return compare(left, right) >= 0;
                case "==":
                    return looseEquals(left, right);
                case "!=":
                    return !looseEquals(left, right);
                case "===":
                    return strictEquals(left, right);
                case "!==":
                    return !strictEquals(left, right);
                default:
                    throw new ScriptException("不支持的运算符: " + op);
            }
        }

        private int compare(Object a, Object b) {
            if (a instanceof Number && b instanceof Number) {
                return Double.compare(toNumber(a), toNumber(b));
            }
            if (a instanceof String sa && b instanceof String sb) {
                return sa.compareTo(sb);
            }
            if (a instanceof Number || b instanceof Number) {
                return Double.compare(toNumber(a), toNumber(b));
            }
            throw new ScriptException("无法比较的值: " + a + " 与 " + b);
        }

        private boolean looseEquals(Object a, Object b) {
            if (a == null || b == null) {
                return a == null && b == null;
            }
            if (a instanceof Boolean || b instanceof Boolean) {
                return toNumber(a) == toNumber(b);
            }
            if (a instanceof Number && b instanceof Number) {
                return toNumber(a) == toNumber(b);
            }
            if (a instanceof String && b instanceof String) {
                return a.equals(b);
            }
            if (a instanceof String || b instanceof String) {
                return toNumber(a) == toNumber(b);
            }
            return a.equals(b);
        }

        private boolean strictEquals(Object a, Object b) {
            if (a == null || b == null) {
                return a == null && b == null;
            }
            if (a instanceof Number && b instanceof Number) {
                return toNumber(a) == toNumber(b);
            }
            return a.equals(b);
        }

        private boolean truthy(Object v) {
            if (v == null) {
                return false;
            }
            if (v instanceof Boolean b) {
                return b;
            }
            if (v instanceof String s) {
                return !s.isEmpty();
            }
            if (v instanceof Number n) {
                double d = n.doubleValue();
                return d != 0 && !Double.isNaN(d);
            }
            return true; // 数组/对象恒为真，与 JS 一致
        }

        private double toNumber(Object v) {
            if (v == null) {
                return 0;
            }
            if (v instanceof Number n) {
                return n.doubleValue();
            }
            if (v instanceof Boolean b) {
                return b ? 1 : 0;
            }
            if (v instanceof String s) {
                if (s.isBlank()) {
                    return 0;
                }
                try {
                    return Double.parseDouble(s.trim());
                } catch (NumberFormatException e) {
                    return Double.NaN;
                }
            }
            return Double.NaN;
        }

        private long toLong(Object v) {
            if (v instanceof Number n) {
                return n.longValue();
            }
            return (long) toNumber(v);
        }

        private String toJsString(Object v) {
            if (v == null) {
                return "null";
            }
            if (v instanceof Boolean b) {
                return b ? "true" : "false";
            }
            if (v instanceof Double d && d == Math.floor(d) && !d.isInfinite()) {
                return String.valueOf(d.longValue());
            }
            return String.valueOf(v);
        }
    }
}
