const { app, dialog, BrowserWindow } = require('electron')
const default_url = '';
// 保持对window对象的全局引用，如果不这么做的话，当JavaScript对象被
// 垃圾回收的时候，window对象将会自动的关闭
let mainWindow;
if (require('electron-squirrel-startup')) return;

const gotTheLock = app.requestSingleInstanceLock()

if (gotTheLock) {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // 当运行第二个实例时,将会聚焦到mainWindow这个窗口
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })
    app.on('ready', createWindow);

} else {
    app.quit()
}

function createWindow() {
    // 创建浏览器窗口。
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        show: false,
        title: ''
    });

    const url = getUrl() || default_url;
    // 然后加载应用的 index.html。
    let contents = mainWindow.webContents;
    // 打开开发者工具
    //mainWindow.webContents.openDevTools()

    // 当 window 被关闭，这个事件会被触发。
    mainWindow.on('closed', () => {
        // 取消引用 window 对象，如果你的应用支持多窗口的话，
        // 通常会把多个 window 对象存放在一个数组里面，
        // 与此同时，你应该删除相应的元素。
        mainWindow = null
    });

    mainWindow.on('ready-to-show', () => {
        console.log('on ready-to-show');
        mainWindow.show();
    })

    contents.on('did-fail-load', () => {
        console.log('Fail to load ' + url);
        console.log('Load err.html');
        contents.loadFile('err.html');
    })

    contents.loadURL(url);
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

function getUrl() {
    try {
        return require('./kis.json').url;
    } catch (e) {
        console.error(e);
    }
    return null;
}
