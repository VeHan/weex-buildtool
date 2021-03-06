'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

exports.checkSDK = checkSDK;
exports.installSDK = installSDK;
exports.pack = pack;

var _userConfig = require('../userConfig');

var _userConfig2 = _interopRequireDefault(_userConfig);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

require('colors');
var path = require('path');
var childProcess = require('child_process');
var fs = require('fs-extra');
var homedir = require('homedir');
var exec = require('sync-exec');

var stdlog = require('../utils/stdlog');

/**
 * 检查 Android SDK 安装情况
 * 若缺少则自动安装
 * 依赖 Android SDK，并须添加环境变量 ANDROID_SDK
 */
function checkSDK() {
  // process.stdout.write('Check Android SDK...'.green);
  stdlog.info('Check Android SDK...');

  return new _promise2.default(function (resolve, reject) {

    var relativeSDKPath = void 0;
    switch (process.platform) {
      case 'win32':
        relativeSDKPath = 'AppData/Local/Android/sdk';
        break;
      case 'darwin':
      default:
        relativeSDKPath = 'Library/Android/sdk';
        break;
    }
    var defualtPath = path.resolve(homedir(), relativeSDKPath);
    defualtPath = fs.existsSync(defualtPath) ? defualtPath : '';
    var sdkPath = process.env.ANDROID_HOME ? process.env.ANDROID_HOME : defualtPath;
    sdkPath = _userConfig2.default.android.sdkDir || sdkPath;
    if (sdkPath) {
      // console.info('installed'.green);
      // process.stdout.write('Check SDK version...'.green);
      stdlog.infoln('installed');
      stdlog.info('Check SDK version...');

      var lack = [];
      if (!fs.existsSync(path.resolve(sdkPath, 'platforms/android-23'))) {
        lack.push('android-23');
      }
      if (!fs.existsSync(path.resolve(sdkPath, 'build-tools/23.0.2'))) {
        lack.push('build-tools-23.0.2');
      }
      if (!fs.existsSync(path.resolve(sdkPath, 'extras/android/m2repository'))) {
        lack.push('extra-android-m2repository');
      }
      process.stdout.write('done\n'.green);
      if (lack.length) {
        // console.info('检测到以下内容尚未安装：\n'.yellow);
        stdlog.warnln('Detected that the following has not been installed:\n');
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = (0, _getIterator3.default)(lack), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var item = _step.value;

            stdlog.textln('    * ' + item);
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        stdlog.infoln('');
        resolve(installSDK(lack, sdkPath));
      } else {

        resolve();
      }
    } else {
      stdlog.textln('');
      reject('Cannot find Android SDK，make sure it has been added to environment variables, see more: ' + 'http://xxxxxx'.underline + ' ');
    }
  });
}

/**
 * 自动安装缺少的sdk
 * 依赖 Android SDK，并须添加环境变量 ANDROID_SDK
 * @param  {Array} lack 缺少的SDK名称
 * @return {Promise}
 */
function installSDK(lack, sdkPath) {
  stdlog.warnln('Auto-installing...');
  lack = lack.join(',');
  return new _promise2.default(function (resolve, reject) {
    var android = childProcess.exec(sdkPath + '/tools/android update sdk --no-ui --all --filter ' + lack);
    stdlog.whitePipe(android.stdout);
    stdlog.redPipe(android.stderr);
    // android.stdout.on('data', data => process.stdout.write(data.grey));
    // android.stderr.on('data', data => process.stdout.write(data.red));
    process.stdin.pipe(android.stdin);
    android.on('close', function (code) {
      if (code) {
        reject('exit code ' + code);
      } else {
        stdlog.warnln('done');
        resolve();
      }
    });
    // android.stdin.write('y\n');
    // android.stdin.write('y\n');
  });
}

/**
 * 打包特定目录下的 Android 工程
 * @param  {absolutePath} buildPath [description]
 * @param  {Boolean} release   是否为发布版，默认为 Debug 版
 * @return {[type]}           [description]
 */
function pack(buildPath, release) {

  return checkSDK().then(function () {
    if (process.platform === 'darwin') {
      return new _promise2.default(function (resolve, reject) {
        // fs.chmodSync(path.join(buildPath, 'playground'), 0o755);
        // let chmod = childProcess.execFile('chmod -755 ' + path.join(buildPath, 'playground', 'gradlew'),
        // {cwd: path.join(buildPath, 'playground')});
        // chmod.on('close', resolve).on('error', reject);
        var dirPath = path.resolve(buildPath, 'playground');
        try {
          exec('chmod -R 755 ' + dirPath, { cwd: dirPath });
          resolve(1);
        } catch (e) {
          reject(1);
        }
      });
    } else {
      return _promise2.default.resolve();
    }
  }).then(function () {
    var arg = release ? 'assembleRelease' : 'assembleDebug';

    return new _promise2.default(function (resolve, reject) {

      stdlog.infoln('Starting gradle...');

      var gradlew = childProcess.execFile(path.join(buildPath, 'playground', 'gradlew' + (process.platform === 'win32' ? '.bat' : '')), [arg], { cwd: path.join(buildPath, 'playground') });

      stdlog.greyPipe(gradlew.stdout);
      stdlog.redPipe(gradlew.stderr);
      // gradlew.stdout.on('data', data => process.stdout.write(data.toString().grey));
      // gradlew.stderr.on('data', data => process.stdout.write(data.toString().red));

      gradlew.on('close', function (code) {
        if (code) {
          reject('error code ' + code);
        } else {
          // stdlog.infoln('Android 打包完成');
          // stdlog.textln('生成的文件位于：'.yellow,
          //   path.resolve(buildPath, 'playground','app/build/outputs/apk/').underline);
          resolve();
        }
      });
    });
  });
}