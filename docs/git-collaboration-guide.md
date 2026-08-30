# 校验模块开发人员 Git 对接指南

本指南面向第一次使用 Git 的开发人员。你的工作是开发 `validator/` 校验模块，消费解析模块输出的 `ParsedModel v1.0.0`，不需要直接读取或解析 XML。

## 一、准备工作

请先安装 Git，并向项目负责人获取：

- 仓库地址；
- 代码托管平台账号和访问权限；
- 使用 HTTPS 的登录凭据，或 SSH 密钥配置方式。

## 二、第一次获取代码

在 PowerShell 中执行：

```powershell
cd E:\301
git clone <仓库地址> sysml-parser
cd sysml-parser
npm install
npm test
npm run build
```

如果测试和构建通过，说明本地环境可以正常工作。不要直接在 `main` 分支上开发。

## 三、创建校验开发分支

```powershell
git switch -c feature/validator-rules
```

以后所有校验代码都在这个分支中完成。建议只修改以下目录：

```text
validator/
```

读取接口说明和样例：

- `docs/parsed-model-contract.md`
- `schema/parsed-model.schema.json`
- `examples/parsed-model.sample.json`
- `validator/README.md`

## 四、开发时的业务边界

校验模块：

- 输入：`ParsedModel v1.0.0`；
- 输出：独立的校验结果，建议标记 `stage: "validate"`；
- 执行：合同约定的 40 条业务规则；
- 不直接读取 XML/XMI；
- 不修改 `src/parser.ts` 的解析逻辑；
- 不覆盖解析模块输出的 `issues`，因为其中只保存 `stage: "parse"` 的解析问题。

如发现解析结果缺少字段，不要直接改解析代码。请先在分支中记录问题，联系解析模块负责人，双方确认后再修改接口契约。

## 五、提交代码

开发一项小功能后，先查看修改内容：

```powershell
git status
git diff
```

运行测试和构建：

```powershell
npm test
npm run build
```

确认只包含自己的校验代码后提交：

```powershell
git add validator
git commit -m "feat(validator): add requirement validation rules"
```

提交信息要说明本次改动的唯一目的，不要把无关文件一起提交。

## 六、推送到远程仓库

第一次推送：

```powershell
git push -u origin feature/validator-rules
```

以后继续开发并推送：

```powershell
git push
```

## 七、提交合并请求

在代码托管平台上创建 Pull Request/Merge Request：

- 源分支：`feature/validator-rules`；
- 目标分支：`main`；
- 标题示例：`feat(validator): implement requirement rules`；
- 说明修改了哪些规则、使用了哪个输入样例、测试是否通过；
- 请求解析模块负责人进行评审。

只有评审通过并且测试通过后，才合并到 `main`。不要自行强制推送或删除 `main` 分支。

## 八、同步解析模块的新版本

开始新一轮开发前，先保存自己的工作并同步远程：

```powershell
git status
git switch main
git pull origin main
git switch feature/validator-rules
git merge main
```

如果出现冲突，不要随意覆盖解析模块的修改。先保留冲突现场，联系负责人处理；解决后执行：

```powershell
git add <已解决的文件>
git commit -m "chore: merge latest main"
```

## 九、常用命令速查

```powershell
git status                 # 查看当前分支和修改
git branch                 # 查看本地分支
git switch main            # 切换到 main
git switch -c <分支名>     # 创建并切换新分支
git pull                   # 拉取当前分支的远程更新
git add <文件或目录>       # 放入待提交区
git commit -m "说明"       # 创建本地提交
git push                   # 推送提交
git log --oneline -5       # 查看最近提交
```

## 十、遇到问题时提供的信息

请不要只发送“Git 报错了”。请同时提供：

```powershell
git status
git branch --show-current
```

以及完整的错误信息。不要执行 `git reset --hard`、强制推送或删除分支，除非负责人明确要求。
