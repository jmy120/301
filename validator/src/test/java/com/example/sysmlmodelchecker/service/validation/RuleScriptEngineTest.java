package com.example.sysmlmodelchecker.service.validation;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 规则脚本解释器测试：使用规则库中的 10 条种子规则脚本验证解释器行为。
 */
class RuleScriptEngineTest {

    private final RuleScriptEngine engine = new RuleScriptEngine();

    private static Map<String, Object> element(Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            map.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return map;
    }

    private static Map<String, Object> context(Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            map.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return map;
    }

    @Test
    void gen001_blockNameNotEmpty() {
        String script = """
                function main(element) {
                  if (element.name == null || element.name.trim() === "") {
                    return false;
                  }
                  return true;
                }
                """;
        assertEquals(false, engine.execute(script, element("name", null), context()));
        assertEquals(false, engine.execute(script, element("name", "   "), context()));
        assertEquals(true, engine.execute(script, element("name", "低轨导航星座"), context()));
    }

    @Test
    void gen002_nameUnique() {
        String script = """
                function main(element, context) {
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < elements.length; i++) {
                    if (elements[i].id !== element.id && elements[i].name === element.name) {
                      return false;
                    }
                  }
                  return true;
                }
                """;
        Map<String, Object> ctx = context("elements", List.of(
                element("id", "e1", "name", "A"),
                element("id", "e2", "name", "A")));
        assertEquals(false, engine.execute(script, element("id", "e3", "name", "A"), ctx));
        Map<String, Object> ctx2 = context("elements", List.of(
                element("id", "e1", "name", "A"),
                element("id", "e2", "name", "B")));
        assertEquals(true, engine.execute(script, element("id", "e3", "name", "C"), ctx2));
    }

    @Test
    void str001_connectorEndpointsExist() {
        String script = """
                function main(element, context) {
                  if (element.sourceId == null || element.targetId == null) {
                    return false;
                  }
                  var elements = context && context.elements ? context.elements : [];
                  var hasSource = false;
                  var hasTarget = false;
                  for (var i = 0; i < elements.length; i++) {
                    if (elements[i].id === element.sourceId) { hasSource = true; }
                    if (elements[i].id === element.targetId) { hasTarget = true; }
                  }
                  return hasSource && hasTarget;
                }
                """;
        Map<String, Object> ctx = context("elements", List.of(
                element("id", "e1"), element("id", "e2")));
        assertEquals(true, engine.execute(script,
                element("sourceId", "e1", "targetId", "e2"), ctx));
        assertEquals(false, engine.execute(script,
                element("sourceId", "e1", "targetId", "ghost"), ctx));
        assertEquals(false, engine.execute(script,
                element("sourceId", null, "targetId", "e2"), ctx));
    }

    @Test
    void fieldRequiredRules() {
        String script = """
                function main(element) {
                  if (element.type == null || element.type === "") {
                    return false;
                  }
                  return true;
                }
                """;
        assertEquals(false, engine.execute(script, element("type", null), context()));
        assertEquals(false, engine.execute(script, element("type", ""), context()));
        assertEquals(true, engine.execute(script, element("type", "Signal"), context()));
    }

    @Test
    void directionRequiredRules() {
        String script = """
                function main(element) {
                  if (element.direction == null || element.direction === "") {
                    return false;
                  }
                  return true;
                }
                """;
        assertEquals(false, engine.execute(script, element(), context()));
        assertEquals(true, engine.execute(script, element("direction", "in"), context()));
    }

    @Test
    void beh001_stateMachineHasInitialState() {
        String script = """
                function main(element) {
                  var states = element.states || [];
                  for (var i = 0; i < states.length; i++) {
                    if (states[i].metaClass === "Pseudostate" && states[i].kind === "initial") {
                      return true;
                    }
                  }
                  return false;
                }
                """;
        Map<String, Object> withInitial = element("states", List.of(
                element("metaClass", "State", "kind", "normal"),
                element("metaClass", "Pseudostate", "kind", "initial")));
        assertEquals(true, engine.execute(script, withInitial, context()));
        Map<String, Object> withoutInitial = element("states", List.of(
                element("metaClass", "State", "kind", "normal")));
        assertEquals(false, engine.execute(script, withoutInitial, context()));
        // states 缺失时回退为空数组，返回 false
        assertEquals(false, engine.execute(script, element(), context()));
    }

    @Test
    void triggerAndUnitRules() {
        String triggerScript = """
                function main(element) {
                  if (element.trigger == null || element.trigger === "") {
                    return false;
                  }
                  return true;
                }
                """;
        assertEquals(false, engine.execute(triggerScript, element(), context()));
        assertEquals(true, engine.execute(triggerScript, element("trigger", "t1"), context()));

        String unitScript = """
                function main(element) {
                  if (element.unit == null || element.unit === "") {
                    return false;
                  }
                  return true;
                }
                """;
        assertEquals(false, engine.execute(unitScript, element(), context()));
        assertEquals(true, engine.execute(unitScript, element("unit", "m"), context()));
    }

    @Test
    void missingMainThrows() {
        assertThrows(IllegalArgumentException.class,
                () -> engine.execute("var x = 1;", element(), context()));
    }

    @Test
    void syntaxErrorThrows() {
        assertThrows(RuleScriptEngine.ScriptException.class,
                () -> engine.execute("function main(element) { if (element.name == null return false; }",
                        element(), context()));
    }

    @Test
    void commentsAreIgnored() {
        String script = """
                // 注释
                function main(element) { /* 块注释 */
                  return element.name === "OK";
                }
                """;
        assertEquals(true, engine.execute(script, element("name", "OK"), context()));
        assertEquals(false, engine.execute(script, element("name", "No"), context()));
    }

    @Test
    void nestedObjectsAndArrays() {
        String script = """
                function main(element, context) {
                  if (context.items == null || context.items.length === 0) {
                    return false;
                  }
                  var first = context.items[0];
                  if (first.value !== 42) {
                    return false;
                  }
                  return true;
                }
                """;
        List<Object> items = new ArrayList<>();
        items.add(element("value", 42));
        Map<String, Object> ctx = context("items", items);
        assertTrue((Boolean) engine.execute(script, element(), ctx));
        assertEquals(false, engine.execute(script, element(), context("items", List.of())));
    }
}