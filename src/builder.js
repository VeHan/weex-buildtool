const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const download = require('download');
const npmlog = require('npmlog');
const glob = require("glob");
const unzip = require('unzip');
const exec = require('sync-exec');
const childProcess = require('child_process');
const stdlog = require('./utils/stdlog');

const packIos = require('./libs/pack-ios');
const icons = require("./libs/config/icons.js");
const androidConfig = require("./libs/config/android.js");
const iosConfig = require("./libs/config/ios.js");
const nwUtils = require('./nw-utils');


import * as packAndorid from "./libs/apkhelper";
import packHtml from "./libs/html5";
import serveHtml from "./libs/html5-server";
import folderSync from './utils/folderSync';


var builder = {
  root: process.cwd(),  // 用户进程运行的目录

  initLife: {
    initial: async function(options) {
      // 判断是否经过 init
      // 返回一个对象,保存文件是否存在的信息


      // 判断文件是否存在

      var configBasePath = path.resolve(options.root, 'config/config.base.js');
      var configAndroidPath = path.resolve(options.root, 'config/config.android.js');
      var configIosPath = path.resolve(options.root, 'config/config.ios.js');
      var projectAndroidPath = path.resolve(options.root, 'android/playground/app/src/main/AndroidManifest.xml')
      var projectIosPath = path.resolve(options.root, 'ios/playground/WeexApp/Info.plist');
      try {
        builder.existFile(configBasePath);
        options.configbase = true;
      } catch (e) {
        options.configbase = false;
      }
      try {
        builder.existFile(configAndroidPath);
        options.configandroid = true;
      } catch (e) {
        options.configandroid = false;
      }
      try {
        builder.existFile(configIosPath);
        options.configios = true;
      } catch (e) {
        options.configios = false;
      }
      try {
        builder.existFile(projectAndroidPath);
        options.projectandroid = true;
      } catch (e) {
        options.projectandroid = false;
      }

      try {
        builder.existFile(projectIosPath);
        options.projectios = true;
      } catch (e) {
        options.projectios = false;
      }

    },
    prompting: async function(options) {
      // 与用户交互

      // 默认是都需要拷贝
      options.overwrite = {
        android: true,
        ios: true
      };
      switch (options.platform) {
        case "android":
          options.overwrite.ios = false;
          await overwriteAndroid();
          break;
        case "ios":
          options.overwrite.android = false;
          await overWriteIos();
          break;
        case "all":
          await overwriteAndroid();
          await overWriteIos();
      }


      async function overwriteAndroid() {
        if (options.projectandroid) {
          await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: 'Android project has existed, overwrite?',
              default: false
            }
          ]).then(function(value) {
            // exec(`pakeex ${value.command}`, {cwd: process.cwd()});
            if (!value.overwrite) {
              options.overwrite.android = false;
            }
          });
        }
      }

      async function overWriteIos() {
        if (options.projectios) {
          await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: 'IOS project has existed, overwrite?',
              default: false
            }
          ]).then(function(value) {
            // exec(`pakeex ${value.command}`, {cwd: process.cwd()});
            if (!value.overwrite) {
              options.overwrite.ios = false;
            }
          });
        }
      }
    },
    configuring(options){
      //console.log("配置文件操作");
      const platform = options.platform;

      let configPath = path.resolve(options.root, 'config');
      fs.ensureDirSync(configPath);

      if (!options.configbase) {
        fs.copySync(path.resolve(options.toolRoot, 'package-template/config/config.base.js'), path.resolve(configPath, 'config.base.js'));
        stdlog.debugln("config.base.js...created");
      } else {
        stdlog.debugln("config.base.js...exists");
      }

      switch (platform) {
        case "android":
          if (!options.configandroid) {
            fs.copySync(path.resolve(options.toolRoot, 'package-template/config/config.android.js'), path.resolve(configPath, 'config.android.js'));
            stdlog.debugln("config.android.js...created");
          } else {
            stdlog.debugln("config.android.js...exists");
          }
          break;
        case "ios":
          if (process.platform === 'darwin') {
            if (!options.configios) {
              fs.copySync(path.resolve(options.toolRoot, 'package-template/config/config.ios.js'), path.resolve(configPath, 'config.ios.js'));
              stdlog.debugln("config.ios.js...created");
            } else {
              stdlog.debugln("config.ios.js...exists");
            }
          }
          break;
        case "all":
          if (!options.configandroid) {
            fs.copySync(path.resolve(options.toolRoot, 'package-template/config/config.android.js'), path.resolve(configPath, 'config.android.js'));
            stdlog.debugln("config.android.js...created");
          } else {
            stdlog.debugln("config.android.js...exists");
          }
          if (!options.configios) {
            fs.copySync(path.resolve(options.toolRoot, 'package-template/config/config.ios.js'), path.resolve(configPath, 'config.ios.js'));
            stdlog.debugln("config.ios.js...created");
          } else {
            stdlog.debugln("config.ios.js...exists");
          }
          break;
      }


      if (options.overwrite.ios || options.overwrite.android) {
        stdlog.info('Generating assets files...');

        let assetsPath = path.resolve(options.root, 'assets');
        fs.ensureDirSync(assetsPath);
        fs.copySync(path.resolve(options.toolRoot, 'package-template', 'assets'), assetsPath);
      }

      stdlog.infoln('done');

      let distPath = path.resolve(options.root, 'dist');
      fs.ensureDirSync(distPath);

    },
    install: async function(options) {
      //console.log("下载安装操作");
      options.download = {};
      var iosPath = path.resolve(options.root, 'ios');
      var androidPath = path.resolve(options.root, 'android');
      if (options.overwrite.ios && options.overwrite.android) {
        fs.removeSync(iosPath);
        fs.removeSync(androidPath);
        stdlog.info("Downloading from internet...");
        await Promise.all([
          download(options.giturl.ios, path.resolve(options.root, '.tmp', 'ios')),
          download(options.giturl.android, path.resolve(options.root, '.tmp', 'android'))
        ])
          .then((value) => {
            stdlog.infoln("done");
            options.download.ios = true;
            options.download.android = true;
          });

      } else if (options.overwrite.ios) {

        fs.removeSync(iosPath);
        stdlog.info("Downloading...");
        await download(options.giturl.ios, path.resolve(options.root, '.tmp', 'ios'))
          .then((value) => {
            stdlog.infoln("done");
            options.download.ios = true;
          });

      } else if (options.overwrite.android) {

        fs.removeSync(androidPath);
        stdlog.info("Downloading...");
        await download(options.giturl.android, path.resolve(options.root, '.tmp', 'android'))
          .then((value) => {
            stdlog.infoln("done");
            options.download.android = true;
          });

      }


      var iosFile = path.resolve(options.root, '.tmp', 'ios', options.giturl.basename || 'master.zip');
      var androidFile = path.resolve(options.root, '.tmp', 'android', options.giturl.basename || 'master.zip');

      var iosTmpPath = path.resolve(options.root, '.tmp', String(Math.floor(Math.random() * 10000000)));
      var androidTmpPath = path.resolve(options.root, '.tmp', String(Math.floor(Math.random() * 10000000)));

      if (options.download.ios) {
        stdlog.info('Unzipping iOS project...');
        await unzipFile(iosFile, iosTmpPath);
        let files = fs.readdirSync(iosTmpPath);
        for (let file of files) {
          let absoluteFilePath = path.resolve(iosTmpPath, file);
          let fileInfo = fs.statSync(absoluteFilePath);
          if (fileInfo.isDirectory()) {
            fs.renameSync(absoluteFilePath, iosPath);
            break;
          }
        }
        stdlog.infoln('done');
        // console.log(path.resolve(iosPath, '.tmp'), iosPath);
      }

      if (options.download.android) {
        stdlog.info('Unzipping Android project...');
        await unzipFile(androidFile, androidTmpPath);
        let files = fs.readdirSync(androidTmpPath);
        for (let file of files) {
          let absoluteFilePath = path.resolve(androidTmpPath, file);
          let fileInfo = fs.statSync(absoluteFilePath);
          if (fileInfo.isDirectory()) {
            fs.renameSync(absoluteFilePath, androidPath);
            break;
          }
        }
        stdlog.infoln('done');
      }

      function unzipFile(filePath, dirPath) {

        fs.ensureDirSync(dirPath);
        stdlog.infoln(`unzip ${filePath}...`);
        return new Promise((resolve, reject) => {
          fs.createReadStream(path.resolve(filePath))
            .pipe(unzip.Extract({path: path.resolve(dirPath)}))
            .on('close', resolve).on('error', reject);
        });
      }

    },
    clean(options) {
      stdlog.infoln("Build init successful!");
      var tmpPath = path.resolve(options.root, '.tmp');
      fs.removeSync(tmpPath);
    }

  },

  async init (options) {

    /*  init 分成几个过程
     *  @param: platform, 根据用户输入的平台进行初始化工作
     *  @param: git, git 仓库地址, 去该仓库下载原始工程
     *  1. initial , 检测当前目录是否经过 init
     *  2. prompting, 与用户交互过程
     *  3. configuring, 创建配置文件
     *  4. install, 为用户下载或者为用户安装依赖
     *  5. end, 清除工作,和用户说 bye
     *
     */
    const lifecycle = ["initial", "prompting", "configuring", "install", "clean"];

    for (let life of lifecycle) {
      await this.initLife[life](options);
    }

  },

  async build (options) {

    // build 初始化判断
    await this.initLife.initial(options);

    const platform = options.platform;

    switch (platform) {
      case 'android':
        if (!options.projectandroid) {
          throw "Can't find project! Execute build init android first!";
        }
        break;
      case 'ios':
        if (!options.projectios) {
          throw "Can't find project! Execute build init ios first!";
        }
        break;
      case 'all':
        if (!options.projectandroid || !options.projectios) {
          throw "Can't find projects! Execute build init first!";
        }
        break;
      default :
        if (!options.configbase) {
        throw " Execute build init first!"
        }
    }

    if (options.release || options.platform === "html") {
      await this.makeJsbundle();
    } else {
      stdlog.warnln('Skip JSBundle generation in debug mode');
    }

    if (platform === 'android') {

      await this.buildAndroid(options);

    } else if (platform === 'ios') {

      await this.buildIos(options);

    } else if (platform === 'html') {

      await this.buildHtml(options);

    } else if (platform === 'all') {

      await this.buildAll(options);

    } else {
      // 渠道包扩展
    }
  },

  buildAndroid: async function(options) {

    const ROOT = process.cwd();
    const PROJECTPATH = path.resolve(ROOT, 'android');
    const BUILDPATH = path.resolve(ROOT, '.build', 'android');

    stdlog.infoln("Building Android package...");

    let ip = nwUtils.getPublicIP();
    let port = '8083';
    let debugPath = `http://${ip}:${port}/main.we`;

    let jsbundle = path.resolve('main.js');

    return folderSync(PROJECTPATH, BUILDPATH)
      .then(() => {
        if (options.release) {
          debugPath = jsbundle;
          let dirPath = path.resolve(ROOT, '.build/android/playground/app/src/main/assets/JSBundle');
          fs.ensureDirSync(dirPath);
          return folderSync(path.resolve(ROOT, 'dist', 'js'), dirPath);
        }
      })
      .then(() => icons.android(BUILDPATH))
      .then(() => androidConfig(options.release, BUILDPATH, debugPath))
      .then(() => packAndorid.pack(BUILDPATH, options.release))
      .then(function() {
        return new Promise((resolve, reject) => {
          glob(`${BUILDPATH}/**/*.apk`, function(er, files) {
            if (er || files.length === 0) {
              stdlog.errorln("failed");
              reject(er);
              // process.exit(1);
            } else {
              let pathDir = path.resolve(files[0], '..');
              fs.copySync(pathDir, 'dist/android/');
              stdlog.infoln(`Android package build successful. The app is in ${path.resolve(ROOT, 'dist', 'android')} `);
              resolve();
            }
          })
        })
      })
  },

  buildIos (options) {
    if (process.platform !== 'darwin') {
      throw 'iOS package can only be build in macOS';
    }

    stdlog.infoln("Building iOS package...");

    const ROOT = process.cwd();
    const BUILDPATH = path.resolve(ROOT, '.build', 'ios');
    const BUILDPLAYGROUND = path.resolve(BUILDPATH, 'playground');
    const IOSPATH = path.resolve(ROOT, 'ios');

    let ip = nwUtils.getPublicIP();
    let port = '8083';
    let debugPath = `http://${ip}:${port}/main.we`;

    return folderSync(IOSPATH, BUILDPATH)
      .then(() => {
        if (options.release) {
          let jsBundle = path.resolve(ROOT, 'dist', 'js');
          let toPath = path.resolve(ROOT, '.build', 'ios', 'playground', 'js.bundle');
          fs.ensureDirSync(toPath);
          fs.emptyDirSync(toPath);
          fs.copySync(jsBundle, toPath);
          debugPath = "main.js";
        }
      })
      .then(() => icons.ios(path.resolve(BUILDPATH)))
      .then(() => iosConfig(options.release, BUILDPATH, debugPath))
      .then(() => {
        let pack = "sim";
        let configPath = process.cwd() + '/config';
        let config = require(path.resolve(configPath, 'config.ios.js'))();

        if (options.release) {

          // 默认是真机
          if (options.isSimulator) {
            pack = "sim";
            let info;
            info = {};
            info.name = "weexapp-release-sim";
            packIos(BUILDPLAYGROUND, options.release, pack, info);
            // release 只打真机的包
          } else {
            pack = "normal";
            let info2;
            info2 = config.certificate;
            info2.name = "weexapp-release-real";
            packIos(BUILDPLAYGROUND, options.release, pack, info2);
          }

        } else {

          if (options.isSimulator) {
            pack = "sim";
            let info1 = {};
            info1.name = "weexapp-debug-sim";
            packIos(BUILDPLAYGROUND, options.release, pack, info1);

          } else {
            pack = "normal";
            let info2 = config.certificate;
            info2.name = "weexapp-debug-real";
            packIos(BUILDPLAYGROUND, options.release, pack, info2);
          }

        }
      })
      .then(() => {
        return new Promise((resolve, reject) => {

          glob(`${BUILDPATH}/**/*.app`, function(er, files) {
            if (er || files.length === 0) {
              stdlog.errorln("failed");
              reject(er);
            } else {
              let pathDir = path.resolve(files[0], '..');
              fs.copySync(pathDir, 'dist/ios/');
              stdlog.infoln(`iOS package build successful. The app is in ${path.resolve(ROOT, 'dist', 'ios')} `);
              resolve();
            }
          })
        })
      })

    // iosConfig(this.release, IOSPATH, debugPath);//处理配置
    // iosConfig(false, IOSPATH, 'main.js');

    // release 没有debugPath
    // console.log("isrelease: ",this.release, "path:", debugPath);

  },

  buildHtml () {
    packHtml();
    serveHtml();
  },

  buildAll: async function (options) {
    await this.buildIos(options);
    await this.buildAndroid(options);
    packHtml();
  },

  makeJsbundle: async function(wePath, jsPath) {

    const rootPath = this.root;
    const bundleInputPath = wePath || path.resolve(rootPath, 'src');
    const bundleOutputPath = jsPath || path.resolve(rootPath, 'dist', 'js');

    fs.ensureDirSync(bundleOutputPath);
    fs.emptyDirSync(bundleOutputPath);

    stdlog.info('Generating JSBundle...');
    await new Promise((resolve, reject) => {
      try {
        var weex = childProcess.exec(`pakeex ${bundleInputPath}/main.we -o ${bundleOutputPath}/main.js`);
      } catch (e) {
        weex = childProcess.exec(`weex ${bundleInputPath}/main.we -o ${bundleOutputPath}/main.js`);
      }
      weex.on('error', reject);
      weex.on('close', resolve);
    })
    // exec(`weex ${bundleInputPath}/main.we -o ${bundleOutputPath}/main.js`);
    stdlog.infoln('done');

    // await new Promise((resolve, reject) => {
    //   stdlog.infoln('Generating JSBundle...');
    //   fs.walk(bundleInputPath)
    //     .on('data', item => {
    //       if (item.stats.isDirectory()) {
    //         const inPath = item.path;
    //         const outPath = path.resolve(bundleOutputPath, path.relative(bundleInputPath, item.path));
    //         fs.ensureDirSync(outPath);
    //         stdlog.debugln(inPath);
    //         exec(`weex ${inPath} -o ${outPath}`);
    //       }
    //     })
    //     .on('end', () => {
    //       stdlog.infoln('Generating JSBundle...done');
    //       resolve();
    //     });
    // });
  },

  existFile (path) {
    fs.accessSync(path, fs.R_OK);
  }

}


module.exports = builder;
