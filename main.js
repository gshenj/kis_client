const { app, dialog, BrowserWindow, autoUpdater, Tray, Menu, ipcMain } = require('electron')
const path = require("path");
const default_url = '';
const dlgIcon = path.join(__dirname, 'app.ico');

let appName = '更新提示';
//console.log('check update');
let message = {
    error: '检查更新出错',
    checking: '正在检查更新……',
    updateAva: '发现新版本，是否更新？',
    updateNotAva: '现在使用的就是最新版本，不用更新',
    downloaded: '最新版本已下载，将在重启程序后更新'
}


// 保持对window对象的全局引用，如果不这么做的话，当JavaScript对象被
// 垃圾回收的时候，window对象将会自动的关闭
let mainWindow;
//if (require('electron-squirrel-startup')) return;
startupEventHandle();

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
        //alwaysOnTop: true,
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
        //mainWindow.maximize();
        mainWindow.show();
    })

    contents.on('did-fail-load', () => {
        console.log('Fail to load ' + url);
        console.log('Load err.html');
        contents.loadFile('err.html');
    })

    contents.loadURL(url);


    ipcMain.on('check-update', (event, arg) => {
        console.log(arg) // prints "ping"
        const request = net.request(getUpdateUrl() + '/RELEASES?t=' + new Date().getTime())
        request.on('response', (response) => {
            console.log(`STATUS: ${response.statusCode}`)
            console.log(`HEADERS: ${JSON.stringify(response.headers)}`)
            let txt = '';
            response.on('data', (chunk) => {
                txt += chunk.toString('utf8')
            })

            response.on('end', () => {
                console.log('No more data in response.')
                let vInfos = txt.split(' ')
                let appNames = vInfos[1].split('-');
                console.log(appNames[1])
                var pjson = require('./package.json');
                console.log(pjson.version)
                if (versionCompare(appNames[1], pjson.version) > 0) {
                    console.log('have')
                    //tipUpdate();
                    //document.getElementById('msg').innerHTML = "发现新版本，是否更新？"
                    event.reply('check-update-reply', appNames[1])
                } else {
                    event.reply('check-update-reply', '')
                }
            })
            response.on('error', () => {
                console.log('err.')
            })
        })
        request.end()
    })



    // add tray
    const appIcon = new Tray(path.join(__dirname, 'app.ico'))
    const contextMenu = Menu.buildFromTemplate([
    {
        label: '检查更新',
        click() {
            ///getUpdates();
            tipUpdate();
            //  checkForUpdates();
        }
    },
    {
        label: '关于',
        click() {
            //mainWindow.webContents.send('show_about')
            const info = JSON.stringify(process.versions);
            console.log(info);
            dialog.showMessageBoxSync(mainWindow, {
                type: 'info',
                icon: dlgIcon,
                buttons: ['OK'],
                title: '关于',
                message: info
            });
        }
    },
    {
        label: '退出',
        click() {
            mainWindow.close();
        }
    }, ])

    // Call this again for Linux because we modified the context menu
    appIcon.setContextMenu(contextMenu)
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
        return require('./kis.json').serverUrl;
    } catch (e) {
        console.error(e);
    }
    return null;
}

function getUpdateUrl() {
    try {
        return require('./kis.json').updateUrl;
    } catch (e) {
        console.error(e);
    }
    return null;
}


function startupEventHandle() {
    if (require('electron-squirrel-startup')) return;
    var handleStartupEvent = function () {
        console.log(process.platform)
        if (process.platform !== 'win32') {
            return false;
        }
        var squirrelCommand = process.argv[1];
        switch (squirrelCommand) {
        case '--squirrel-install':
        case '--squirrel-updated':
            install();
            return true;
        case '--squirrel-uninstall':
            uninstall();
            app.quit();
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
    };
    if (handleStartupEvent()) {
        return;
    }
}

function updateHandle() {
    ipc.on('check-for-update', function (event, arg) {
        checkForUpdates();
    });
}

function checkForUpdates() {

    const updateUrl = getUpdateUrl();
    if (!updateUrl) {
        console.log('No update url!')
        return false;
    }

    autoUpdater.setFeedURL(updateUrl);
    autoUpdater.on('error', function (error) {
        console.log(error)
        return dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            icon: dlgIcon,
            buttons: ['OK'],
            title: appName,
            message: message.error,
            detail: '\r' + error
        });
    })
    autoUpdater.on('checking-for-update', function (e) {
        // return dialog.showMessageBoxSync(mainWindow, {
        //     type: 'info',
        //     icon: dlgIcon,
        //     buttons: [],
        //     title: appName,
        //     message: message.checking
        // });
    })
    autoUpdater.on('update-available', function (e) {
        // var downloadConfirmation = dialog.showMessageBoxSync(mainWindow, {
        //     type: 'info',
        //     icon: dlgIcon,
        //     buttons: ['OK'],
        //     title: appName,
        //     message: message.updateAva
        // });
        // if (downloadConfirmation === 0) {

        //     return true;
        // } else {
        //     return false;
        // }
    })
    autoUpdater.on('update-not-available', function (e) {
        return dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            icon: dlgIcon,
            buttons: ['OK'],
            title: appName,
            message: message.updateNotAva
        });
    })
    autoUpdater.on('update-downloaded', function (event, releaseNotes, releaseName, releaseDate, updateUrl, quitAndUpdate) {
        var index = dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            icon: dlgIcon,
            buttons: ['现在重启', '稍后重启'],
            title: appName,
            message: message.downloaded,
            detail: releaseName + "\n\n" + releaseNotes
        });
        if (index === 1) return;
        autoUpdater.quitAndInstall();
    });

    autoUpdater.checkForUpdates();
}



/*
function getUpdates() {
    const { net } = require('electron')
    const request = net.request(getUpdateUrl() + '/RELEASES?t=' + new Date().getTime())
    request.on('response', (response) => {
        console.log(`STATUS: ${response.statusCode}`)
        console.log(`HEADERS: ${JSON.stringify(response.headers)}`)
        let txt = '';
        response.on('data', (chunk) => {
            txt += chunk.toString('utf8')
        })

        response.on('end', () => {
            console.log('No more data in response.')
            let vInfos = txt.split(' ')
            let appNames = vInfos[1].split('-');
            console.log(appNames[1])
            var pjson = require('./package.json');
            console.log(pjson.version)
            if (versionCompare(appNames[1], pjson.version) > 0) {
                console.log('have')
                tipUpdate();
            } else {
                console.log('no')
            }

        })
        response.on('error', () => {
            console.log('err.')
        })
    })
    request.end()
}

*/

function tipUpdate() {
    let child = new BrowserWindow({
        parent: mainWindow,
        modal: true,
        width: 400,
        height: 300,
        autoHideMenuBar: true,
        show: false,
        title: '系统更新'
    })
    child.loadFile('update.html')
    child.once('ready-to-show', () => {
        child.show()
    })
}


function versionCompare(v1, v2) {
    let arr1 = v1.split('.');
    let arr2 = v2.split('.');
    let i = 0;
    for (;;) {
        if (arr1[i] && arr2[i]) {
            arr1[i] = parseInt(arr1[i])
            arr2[i] = parseInt(arr2[i])
            if (arr1[i] == arr2[i]) {
                i++;
                continue;
            } else if (arr1[i] > arr2[i]) {
                return 1;
            } else {
                return -1;
            }

        } else {
            // 版本不一致，无法比较，或者相同
            return 0
        }
    }
}