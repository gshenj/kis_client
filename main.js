const { app, BrowserWindow, autoUpdater, Tray, Menu, ipcMain, net } = require('electron')
const path = require("path")
const appIcon = path.join(__dirname, 'app.ico')
// 保持对window对象的全局引用，如果不这么做的话，当JavaScript对象被
// 垃圾回收的时候，window对象将会自动的关闭
let mainWindow, aboutWindow;

if (require('electron-squirrel-startup')) {
    return false
}

//startupEventHandle();
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    app.quit()
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
    // 当运行第二个实例时,将会聚焦到mainWindow这个窗口
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
    }
})

app.on('ready', createWindow)

ipcMain.on('check-update', (event, arg) => {
    const request = net.request(getUpdateUrl() + '/RELEASES?t=' + new Date().getTime())
    request.on('response', (response) => {
        let txt = ''
        response.on('data', (chunk) => {
            txt += chunk.toString('utf8')
        })
        response.on('end', () => {
            let vInfos = txt.split(' ')
            let appNames = vInfos[1].split('-')
            var pjson = require('./package.json')
            let ret = null;
            if (versionCompare(appNames[1], pjson.version) > 0) {
                ret = { currentVersion: pjson.version, newVersion: appNames[1] }
            }
            sendToAboutWindow('check-update-reply', ret)
        })
        response.on('error', () => {
            sendToAboutWindow('update-error', null)
        })
    })
    request.on('error', (error) => {
        sendToAboutWindow('update-error', error)
    })
    request.end()
})

ipcMain.on('start-update', (event, arg) => {
    const updateUrl = getUpdateUrl()
    if (!updateUrl) {
        console.log('No update url!')
        return false
    }
    autoUpdater.setFeedURL(updateUrl)
    autoUpdater.checkForUpdates()
})

ipcMain.on('quit-and-install', (event, arg) => {
    autoUpdater.quitAndInstall()
})

function createWindow() {
    mainWindow = new BrowserWindow({
        icon: appIcon,
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        show: false,
        title: '',
        webPreferences: { devTools: true, enableRemoteModule: true }
    })

    const url = getUrl() || ''
    // 然后加载应用的 index.html。
    let contents = mainWindow.webContents
    // 当 window 被关闭，这个事件会被触发。
    mainWindow.on('closed', () => {
        mainWindow = null
    });

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
            label: '关于        ',
            click() {
                showAbout()
            }
        },
        {
            label: '退出        ',
            click() {
                mainWindow.close()
            }
        }])
    // Call this again for Linux because we modified the context menu
    //appIcon.setContextMenu(contextMenu);
    appTray.on('click', (event, bounds, position) => {
        mainWindow.show();
    })
    appTray.on('right-click', (event, bounds) => {
        appTray.popUpContextMenu(contextMenu)
    })
    //初始化更新器
    initAutoUpdater()
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
        return require('./kis.json').serverUrl
    } catch (e) {
        console.error(e)
    }
    return null
}

function getUpdateUrl() {
    try {
        return require('./kis.json').updateUrl
    } catch (e) {
        console.error(e)
    }
    return null;
}

function startupEventHandle() {
    var handleStartupEvent = function () {
        //console.log(process.platform)
        if (process.platform !== 'win32') {
            return false
        }
        var squirrelCommand = process.argv[1];
        switch (squirrelCommand) {
            case '--squirrel-install':
            case '--squirrel-updated':
                showMessageBox('确定安装')
                install();
                return true;
            case '--squirrel-uninstall':
                showMessageBox('确定卸载')
                uninstall();
                //app.quit();
                return true;
            case '--squirrel-obsolete':
                app.quit();
                return true;
        }
        // 安装
        function install() {
            var cp = require('child_process');
            var updateDotExe = path.resolve(path.dirname(process.execPath), '..', 'update.exe');
            var target = path.basename(process.execPath);
            var child = cp.spawn(updateDotExe, ["--createShortcut", target], { detached: true });
            child.on('close', function (code) {
                app.quit();
            });
        }
        // 卸载
        function uninstall() {
            var cp = require('child_process');
            var updateDotExe = path.resolve(path.dirname(process.execPath), '..', 'update.exe');
            var target = path.basename(process.execPath);
            var child = cp.spawn(updateDotExe, ["--removeShortcut", target], { detached: true });
            child.on('close', function (code) {
                app.quit();
            });
        }
    }
    if (handleStartupEvent()) {
        return
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
            devTools: false,
            nodeIntegration: true
        }
    })
    const clientVersion = require('./package.json').version
    const electronVersion = process.versions.electron
    const chromeVersion = process.versions.chrome
    const nodeVersion = process.versions.node
    const data = { clientVersion, electronVersion, chromeVersion, nodeVersion }
    const querystring = require('querystring')
    const parameter = querystring.stringify(data)
    aboutWindow.loadURL(`file://${__dirname}/about.html?${parameter}`)
    aboutWindow.on('closed', () => {
        aboutWindow = null
    })
    aboutWindow.once('ready-to-show', () => {
        aboutWindow.show()
    })
}

function initAutoUpdater() {
    autoUpdater.on('error', function (error) {
        sendToAboutWindow('update-error', error)
    })
    autoUpdater.on('update-not-available', function (e) {
        sendToAboutWindow('update-not-available', null)
    })
    autoUpdater.on('update-downloaded', function (event1, releaseNotes, releaseName, releaseDate, updateUrl, quitAndUpdate) {
        sendToAboutWindow('update-downloaded', releaseName)
    })
}

function versionCompare(v1, v2) {
    let i = 0, arr1 = v1.split('.'), arr2 = v2.split('.')
    while (1) {
        if (arr1[i] && arr2[i]) {
            arr1[i] = parseInt(arr1[i])
            arr2[i] = parseInt(arr2[i])
            if (arr1[i] == arr2[i]) {
                i++
                continue
            } else if (arr1[i] > arr2[i]) {
                return 1
            } else {
                return -1
            }
        } else {
            // 版本不一致，无法比较，或者相同
            return 0
        }
    }
}

function sendToAboutWindow(chanel, arg) {
    try {
        aboutWindow.webContents.send(chanel, arg)
    } catch (e) {
        console.log(e)
    }
}