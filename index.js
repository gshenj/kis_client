const { app, BrowserWindow } = require('electron')
const fs = require('fs');

// 保持对window对象的全局引用，如果不这么做的话，当JavaScript对象被
// 垃圾回收的时候，window对象将会自动的关闭
let mainWindow
if (require('electron-squirrel-startup')) return;

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // 当运行第二个实例时,将会聚焦到mainWindow这个窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // 创建 myWindow, 加载应用的其余部分, etc...
  app.on('ready', createWindow)
}

function createWindow() {
  // 创建浏览器窗口。
  mainWindow = new BrowserWindow({ width: 1200, height: 800, autoHideMenuBar: true, title: '' })
  let url = 'http://localhost/kis/index';
  try {
    const kisJson = getKisJson()
    url = kisJson.url;
  } catch (e) {
    console.error(e);
  }

  // 然后加载应用的 index.html。
  mainWindow.loadURL(url);

  // 打开开发者工具
  //win.webContents.openDevTools()

  // 当 window 被关闭，这个事件会被触发。
  mainWindow.on('closed', () => {
    // 取消引用 window 对象，如果你的应用支持多窗口的话，
    // 通常会把多个 window 对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    mainWindow = null
  })
}

// 当全部窗口关闭时退出。
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (mainWindow === null) {
    createWindow()
  }
})

function getKisJson() {
  const _packageJson = fs.readFileSync(__dirname + '/kis.json')
  return JSON.parse(_packageJson)
}
