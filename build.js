var electronInstaller = require('electron-winstaller');
var path = require("path");

var now = new Date();
resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: path.join('../build_out/kis-win32-ia32'), //刚才生成打包文件的路径
    outputDirectory: path.join('../build_out/'), //输出路径
    setupIcon: path.resolve('images/kis_256px.ico'),
    iconUrl: path.resolve('images/kis_256px.ico'),
    loadingGif:path.join('images/loadingInstall.gif'),
    authors: 'shenjin', // 作者名称
    exe: 'kis.exe', //在appDirectory寻找exe的名字;
    setupExe:'kis-'+ now.getFullYear()+ (now.getMonth()+1) + now.getDate() + '.exe',
    noMsi: true
});

resultPromise.then(() => console.log("build ok!"), (e) => console.log(`No dice: ${e.message}`));
