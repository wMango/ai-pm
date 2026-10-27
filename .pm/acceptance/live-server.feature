# language: zh-CN
# live-server（本地实时服务）的接口契约；支撑 f-live-map
# 测试：tests/live/serve.test.ts、tests/live/live-dom.test.ts

功能: 只读、只在本机的实时地图服务

  场景: 只监听 127.0.0.1；Host 头不是 127.0.0.1 或 localhost 的请求返回 403
  场景: 只接受 GET；路径只认 /、/dashboard.html、/data.json、/events 与 /history/ 下的页面，其余 404
  场景: 地图页带「实时」标记，CSP 只额外放开同源连接；响应带 nosniff 与 no-store
  场景: 定时检查 .pm 下的输入文件，变化后重算并通过 /events 推送新版本号
  场景: 页面收到推送后取 /data.json 原地重绘，保留视图、视角与选中模块
  场景: 没有打开的页面、也没有新请求超过 idle 时长时自动关闭；有页面开着时不关闭
  场景: pm dashboard 默认在页面旁写 dashboard-data.js（已 gitignore），版本号不含生成时间；页面每 2 秒重新加载它，后台标签页暂停
  场景: 本地文件页的 CSP 只额外放开 script-src 'self'，不放开任何连接；--static 两者都不带
