const { app, BrowserWindow, dialog, Tray, Menu, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
autoUpdater.logger = require('electron-log')
autoUpdater.logger.transports.file.level = 'debug'
const path = require('path')
const fs = require('fs')
const clearFlagFileName = '.clear'
const appIcon = path.join(__dirname, 'app.ico')
//const appData = path.join(path.dirname(process.execPath), 'data')
//系统默认就是这个位置
const appData = path.join(app.getPath('userData', app.name))
const clearFlagFile = path.join(appData, clearFlagFileName)
let mainWindow, aboutWindow

if (fs.existsSync(clearFlagFile)) {
    //清空缓存,rmdirSync开始于node 12.10
    fs.rmdirSync(appData, { recursive: true })
}

app.setPath('userData', appData)

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) app.quit()

app.on('second-instance', () => {
    // 当运行第二个实例时,将会聚焦到mainWindow这个窗口
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
    }
})

app.on('ready', createWindow)

ipcMain.on('check-update', () => {
    autoUpdater.checkForUpdates()
})

ipcMain.on('update-start-download', () => {
    autoUpdater.downloadUpdate()
})

ipcMain.on('quit-and-install', () => {
    autoUpdater.quitAndInstall()
})

ipcMain.on('clear-app-data', () => {
    clearAppData()
})

function initAutoUpdater() {
    autoUpdater.autoDownload = false // 关闭自动更新
    autoUpdater.autoInstallOnAppQuit = false // APP退出的时候自动安装

    autoUpdater.on('checking-for-update', () => {
        console.debug('checking update...')
        sendToAboutWindow('checking-for-update')
    })
    autoUpdater.on('update-available', info => {
        // 可以更新版本
        console.debug(info)
        sendToAboutWindow('update-available', info)
    })
    autoUpdater.on('update-not-available', info => {
        // 不能够更新
        console.debug(info)
        sendToAboutWindow('update-not-available', null)
    })
    autoUpdater.on('error', err => {
        // 更新错误
        console.error(err)
        sendToAboutWindow('update-error', err)
    })
    autoUpdater.on('download-progress', progressObj => {
        // 正在下载的下载进度
        //console.log(progressObj)
        //console.log('Download progress ' + progressObj.percent)
        sendToAboutWindow('download-progress', progressObj.percent)
    })
    autoUpdater.on('update-downloaded', info => {
        // 下载完成
        console.debug(info)
        sendToAboutWindow('update-downloaded')
    })
}

function createWindow() {
    mainWindow = new BrowserWindow({
        icon: appIcon,
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        show: false,
        title: '',
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            enableRemoteModule: true,
        },
    })

    const url = getUrl() || 'http://148.70.243.239/kis/index'
    //console.log(url)
    // 然后加载应用的 index.html
    let contents = mainWindow.webContents
    // 当 window 被关闭，这个事件会被触发
    mainWindow.on('closed', () => {
        mainWindow = null
        if (aboutWindow) {
            aboutWindow.close()
        }
        app.quit()
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
        mainWindow.maximize()
    })

    contents.on('did-fail-load', () => {
        contents.loadURL(`file://${__dirname}/err.html`)
    })

    contents.loadURL(url)
    // add tray
    const appTray = new Tray(appIcon)
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '清空应用缓存',
            click() {
                clearAppData()
            },
        },
        {
            label: '关于',
            click() {
                showAbout()
            },
        },
        {
            label: '退出',
            click() {
                mainWindow.close()
            },
        },
    ])
    // Call this again for Linux because we modified the context menu
    //appIcon.setContextMenu(contextMenu);
    appTray.on('click', () => {
        mainWindow.show()
    })
    appTray.on('right-click', () => {
        appTray.popUpContextMenu(contextMenu)
    })
    //初始化更新器
    initAutoUpdater()
}

// 当全部窗口关闭时退出
app.on('window-all-closed', () => {
    // 在 macOS 上，除非用户用 Cmd + Q 确定地退出
    // 否则绝大部分应用及其菜单栏会保持激活
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (mainWindow === null) createWindow()
})


/* 
* kis.json content like this: 
    {
        "serverUrl": "http://148.70.243.239/kis/index"
    } 
*
*/
function getUrl() {
    if (! fs.existsSync('./kis.json')) return null
    try {
        return require('./kis.json').serverUrl
    } catch (e) {
        console.error(e)
    }
    return null
}

function showAbout() {
    if (aboutWindow) {
        aboutWindow.show()
        return false
    }
    aboutWindow = new BrowserWindow({
        parent: mainWindow,
        maximizable: false,
        minimizable: false,
        resizable: false,
        modal: true,
        width: 450,
        height: 350,
        autoHideMenuBar: true,
        show: false,
        title: '关于系统',
        icon: appIcon,
        webPreferences: {
            //devTools: false,
            nodeIntegration: true,
        },
    })
    const clientVersion = require('./package.json').version
    const electronVersion = process.versions.electron
    const chromeVersion = process.versions.chrome
    const nodeVersion = process.versions.node
    const data = { clientVersion, electronVersion, chromeVersion, nodeVersion }
    const querystring = require('querystring')
    const parameter = querystring.stringify(data)
    aboutWindow.loadURL(`file://${__dirname}/about.html?${parameter}`)

    aboutWindow.on('close', e => {
        e.preventDefault() //阻止默认行为，一定要有
        aboutWindow.hide()
    })

    aboutWindow.on('closed', () => {
        aboutWindow = null
    })
    aboutWindow.once('ready-to-show', () => {
        aboutWindow.show()
    })
}

function sendToAboutWindow(chanel, arg) {
    try {
        aboutWindow.webContents.send(chanel, arg)
    } catch (e) {
        ///console.log(e)
    }
}

function clearAppData() {
    const options = {
        type: 'question',
        title: '确定',
        message: '清除应用缓存数据后程序将重新启动，是否确定?',
        buttons: ['确定', '取消'],
    }
    dialog.showMessageBox(options).then(result => {
        if (result.response == 0) {
            fs.writeFileSync(clearFlagFile)
            app.relaunch()
            app.quit(0)
        }
    })
}
