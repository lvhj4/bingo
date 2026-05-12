# 图片宫格生成器 / 翻牌配对

静态站点，包含 `index.html`、`app.js`、`styles.css`、`images-list.js` 与图片文件夹 `图片/`。

快速部署到 GitHub Pages：

1. 在本地将文件提交到 Git，并推送到 GitHub 仓库（参见下方命令）。
2. 在仓库 Settings → Pages 中选择 `main` 分支与根目录（Root），保存并等待几分钟。
3. 访问 `https://<你的用户名>.github.io/<仓库名>/` 即可在手机端打开并使用“生成分享链接”功能。

注意：若文件名含非 ASCII 字符，站点中已对图片路径做 `encodeURIComponent` 编码，部署后图片应能正确加载。

如需帮助把当前工作区推到 GitHub，我可以生成需要运行的命令或帮你生成 `gh` CLI 的一键操作脚本。

---
项目目录示例：

```
index.html
app.js
styles.css
images-list.js
图片/
  ├─ a.jpg
  └─ b.png
```
