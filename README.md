# Quality Inspection Board

面向质检部门电视看板的实现，数据链路为：

1. 局域网任意 PC 打开导入页
2. 上传一份包含 `检验明细`、`退换货明细`、`月度黑榜` 三个 Sheet 的 Excel
3. 服务端解析 Excel、写入 SQLite、生成发布版本
4. TV 页面以“单表单屏”方式轮播三张表
5. 瘦主机打开 TV 页面并通过 SSE 自动刷新

## 当前架构

- `public/import.html`
  - 导入页，仅负责上传质检 Excel 与元信息
- `public/tv.html`
  - 瘦主机展示页，只读取当前已发布版本，并按三屏顺序轮播
- `server/routes`
  - HTTP 路由层
- `server/services`
  - 导入、发布、查询等业务编排
- `server/adapters/excelAdapter.js`
  - Excel 解析适配器
- `server/repositories`
  - SQLite 读写
- `data/quality-inspection-board.db`
  - 本地数据库

## 设计原则

- KISS：当前只做 Excel 单文件三 Sheet 导入、持久化发布、电视刷新
- KISS：当前只做单表单屏轮播
- YAGNI：暂不引入权限系统、复杂规则引擎、多屏编排后台
- DRY：Excel 统一由服务端转换为标准看板快照

## 运行方式

先安装依赖：

```bash
npm install
```

启动服务：

```bash
npm start
```

默认地址：

- TV 看板：`http://localhost:8094/tv.html`
- Excel 导入台：`http://localhost:8094/import.html`
- 健康检查：`http://localhost:8094/health`

## 接口

- `POST /api/imports`
  - `multipart/form-data`
  - 字段：`boardTitle` `screenCode` `updatedBy` `sourceSummary` `tableTitleA` `tableTitleB` `tableTitleC` `durationSecondsA` `durationSecondsB` `durationSecondsC` `visibleRowCount` `file`
- `GET /api/board/current?screenCode=quality-tv-01`
  - 返回当前已发布版本
- `GET /events`
  - SSE 推送 `board-published`

## Excel 约定

- 上传一份 Excel
- 必须包含 `检验明细`、`退换货明细`、`月度黑榜` 三个工作表
- `检验明细`、`退换货明细` 第一行作为表头
- `月度黑榜` 第二行作为表头
- 后续非空行作为数据行
- 空白行会被过滤
- 单文件大小限制：10MB
- 单表数据行限制：10000 行

## 当前显示规则

- `检验明细`、`退换货明细`、`月度黑榜` 分别对应一张屏
- TV 页面一次只显示一张表
- 三张表按顺序轮播
- 每张表可单独配置停留时长
- 未配置停留时长时，服务端根据数据行数自动计算
- 当数据行数超过单屏可见阈值时，当前屏内会自动从下往上滚动

## 后续扩展方向

- 增加导入记录查询与版本回滚
- 接入 SAP 适配器，复用同一套看板快照模型
- 增加规则引擎层做过滤、映射和聚合
- 为瘦主机提供 kiosk 壳程序或开机自启配置
