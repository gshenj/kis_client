const electronInstaller = require('electron-winstaller')
const path = require('path')
const packager = require('electron-packager')

const buildOptions = {
    dir: __dirname,
    extraResource: __dirname,
    out: 'build',
    platform: 'win32',
    arch: 'ia32',
    icon: 'app.ico',
    electronVersion: '8.0.0',
    overwrite: true,
    download: {
        mirrorOptions: 'https://npm.taobao.org/mirrors/electron/',
    },
    //ignore: '.vscode|.prettierrc.json|data|images|build|build.js',
}

buildApp = packager(buildOptions)

resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: path.join('build/kis-win32-ia32'), //刚才生成打包文件的路径
    outputDirectory: path.join('build/'), //输出路径
    setupIcon: path.resolve('images/kis_256px.ico'),
    iconUrl: path.resolve('./app.ico'),
    loadingGif: path.join('images/loadingInstall.gif'),
    authors: 'shenjin', // 作者名称
    exe: 'kis.exe', //在appDirectory寻找exe的名字;
    setupExe: 'setup.exe', //'kis-'+ now.getFullYear()+ (now.getMonth()+1) + now.getDate() + '.exe',
    noMsi: true,
})

// buildApp.then(() => {
    resultPromise.then(
        () => console.log('build ok!'),
        e => console.log(`No dice: ${e.message}`)
    )
// })
