'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

exports.handle = handle;
exports.android = android;
exports.ios = ios;

var _userConfig = require('./userConfig');

var _userConfig2 = _interopRequireDefault(_userConfig);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var path = require('path');
var inquirer = require('inquirer');
var fs = require('fs-extra');
var adbhelper = require('./libs/adbhelper');
var simIOS = require('./libs/sim-ios.js');
var realIOS = require('./libs/install-ios.js');
var glob = require('glob');


var rootPath = process.cwd();

function handle(platform, release) {
  if (platform === 'android') {
    return android(release);
  } else if (platform === 'ios') {
    return ios(release);
    // } else if (platform === 'h5') {
    //   return h5();
  } else {
    throw 'Unrecognized platform <' + platform + '>';
  }
}

function android(release) {
  var packageName = _userConfig2.default.android.packagename;
  if (release) {
    var filename = path.join(rootPath, 'dist/android/app-release.apk');
    checkFileExist(filename);
    return adbhelper.runApp(filename, packageName, 'com.alibaba.weex.SplashActivity');
  } else {
    var _filename = path.join(rootPath, 'dist/android/app-debug.apk');
    checkFileExist(_filename);
    return adbhelper.runApp(_filename, packageName, 'com.alibaba.weex.SplashActivity');
  }
}

function ios(release) {
  return inquirer.prompt([{
    type: 'list',
    name: 'target',
    message: 'Do you want to use real devices or simulator?',
    choices: [{ value: true, name: 'Simulator' }, { value: false, name: 'Real Device' }]
  }]).then(function (answers) {

    var isSimulator = answers.target;

    var filename = path.join(rootPath, 'dist/ios/weexapp-' + (release ? 'release' : 'debug') + '-' + (isSimulator ? 'sim' : 'real') + '.' + (isSimulator ? 'app' : 'ipa'));
    // let filename = path.join(rootPath, 'dist', 'ios', 'WeexApp.app');
    var filepath = path.join(rootPath, 'dist/ios');
    if (isSimulator) {
      fs.readdir(filepath, function (err, files) {
        if (err || files.length === 0) {
          console.error("dist > ios 中找不到文件!");
        } else {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = (0, _getIterator3.default)(files), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var name = _step.value;

              if (name.indexOf('sim') !== -1) {
                filename = path.join(rootPath, 'dist/ios/' + name);
                if (isSimulator) {
                  var params = {
                    name: _userConfig2.default.ios.name,
                    appId: _userConfig2.default.ios.appid,
                    path: filename
                  };
                  console.log(params);

                  return simIOS(params);
                } else {
                  return realIOS(filename);
                }
              }
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
        }
      });
    } else {
      fs.readdir(filepath, function (err, files) {
        if (err || files.length === 0) {
          console.error("dist > ios 中找不到文件!");
        } else {
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = (0, _getIterator3.default)(files), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              var name = _step2.value;

              if (name.indexOf('real') !== -1 && name.endsWith('.ipa')) {
                filename = path.join(rootPath, 'dist/ios/' + name);
                if (isSimulator) {
                  var params = {
                    name: _userConfig2.default.ios.name,
                    appId: _userConfig2.default.ios.appid,
                    path: filename
                  };
                  console.log(params);
                  return simIOS(params);
                } else {
                  return realIOS(filename);
                }
              }
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
              }
            } finally {
              if (_didIteratorError2) {
                throw _iteratorError2;
              }
            }
          }
        }
      });
    }
    console.log(release, isSimulator, filename);
  });
}

function checkFileExist(file) {
  var exists = fs.existsSync(file);
  if (exists) {
    return true;
  } else {
    throw 'Cannot find package file at ' + file;
  }
}