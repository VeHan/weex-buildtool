'use strict';

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Promise = require('bluebird'),
    inquirer = require('inquirer'),
    colors = require('colors'),
    exec = require('sync-exec'),
    fs = require('fs'),
    path = require('path');

// var debug = require('debug')('start');
var config = {
  XCODE_PATH: '/Applications/Xcode.app/Contents/Developer'
};

function start(params) {
  if (!params.name) {
    params.name = 'example';
  }
  return currentSimulator().then(function (devicePolymer) {
    return run(params, devicePolymer);
  });
}

function run(params, devicePolymer) {
  var iOSCurrentDeviceInfo = devicePolymer.iOSCurrentDevice,
      iOSDevices = devicePolymer.iOSDevice;

  // 选择模拟器
  return iOSimulatorSelect(iOSCurrentDeviceInfo, iOSDevices, params).then(function (currentDevice) {
    // 打开模拟器
    // debug(':::iOS simulator start open :::');
    iOSCurrentDeviceInfo = currentDevice;
    return iOSimulatorOpen(currentDevice, params);
  }).then(function () {
    // debug(':::iOS simulator start install :::');
    return installiOSApp(params);
  }).then(function (url) {
    params.url = url;
    return iOSAppOpen(iOSCurrentDeviceInfo, params);
  }).catch(function (err) {
    consoleLog(err, 'red');
  });
}

// 判断当前运行设备
function currentSimulator() {
  return new Promise(function (resolve) {
    var devicePolymer = {};

    getDevicesList(null).then(function (device) {
      var currentDevice = findCurrentDevice(device.devices);

      devicePolymer.iOSDevice = device;

      // if(currentDevice && currentDevice.name.indexOf('simctl') > -1){

      // debug('iOS simulator running:::' + JSON.stringify(currentDevice,null,2));
      // 确定iOS模拟器已经启动
      // callback(false, 'iOS', currentDevice, device);
      devicePolymer.iOSCurrentDevice = currentDevice;
      devicePolymer.iOS = true;
      devicePolymer.simulator = 'iOS';
      resolve(devicePolymer);
    });
  });
}

//ios
function getDevicesList(device) {
  return new Promise(function (resolve, reject) {

    if (device) {
      // 已经执行过
      resolve(device);
      return;
    }

    syncExecPromise('xcrun simctl list devices').then(function (result) {

      var devices = {},
          osVersion = '',
          devicesType = [],
          simctlDevices = [];

      var rex = new RegExp(' iOS(.*?)--(\\s+)(.*\\s+)*?--', 'igm');
      var itemRex = new RegExp('^(.*?)\\((.*?)\\) \\((.*?)\\)( \\((.*?)\\))?$', 'i');
      var versionArray = result.match(rex);

      if (versionArray) {
        versionArray.forEach(function (simulator) {

          var devicesArray = simulator.split('\n');
          osVersion = devicesArray[0].split(' --')[0].trim();
          devicesArray.forEach(function (itemDevice) {

            var itemDeviceInfo = itemDevice.match(itemRex);
            var isUnavailable = itemDeviceInfo && itemDeviceInfo[4] && itemDeviceInfo[4].indexOf('unavailable') > -1;

            //console.log(itemDeviceInfo && !isUnavailable);

            if (itemDeviceInfo && !isUnavailable) {
              var deviceName = itemDeviceInfo[1].trim() + ' (' + osVersion + ')';
              var tempDevices = {
                'name': deviceName,
                'uuid': itemDeviceInfo[2],
                'status': itemDeviceInfo[3]
              };

              devices[deviceName] = tempDevices;

              devicesType.push(deviceName);
            }
          });
        });
      }

      resolve({
        'devices': devices,
        'devicesType': devicesType,
        'simctlDevices': simctlDevices
      });
    }, function (err) {
      reject(err);
    });
  });
}

function iOSimulatorOpen(currentDevice, params) {
  var fullPath;
  // var simulatorPath = path.join(config.XCODE_PATH, '/Applications/iOS Simulator.app');
  var simulatorPath = path.join(config.XCODE_PATH, '/Applications/Simulator.app');
  var cycle = 0;
  var MAXCOUNET = 20;
  var uuid = currentDevice.uuid;
  var name = currentDevice.name;

  fullPath = simulatorPath.replace(" ", "\\ ");

  return new Promise(function (resolve, reject) {

    if (currentDevice.status === 'Booted') {
      resolve();
      return;
    }

    var cmd = 'open -a ' + fullPath + ' --args -CurrentDeviceUDID ' + uuid,
        std = syncExec(cmd),
        stdout = std.stdout,
        stderr = std.stderr;

    if (stderr) {
      cmd = 'xcrun instruments -w ' + uuid;
      std = syncExec(cmd);
      stdout = std.stdout;
      stderr = std.stderr;
    }

    var status = function status() {
      getDevicesList(null, params).then(function (device) {
        var currentDevice = device.devices[name];

        if (currentDevice.status === 'Booted') {
          console.log('iOS simulator booted !'.green);
          resolve();
        } else if (cycle > MAXCOUNET) {
          reject('iOS simulator not booted !');
        } else {
          cycle++;
          console.log('checker devices status...'.yellow);
          checker();
        }
      });
    };

    var checker = function checker(timeout) {
      setTimeout(status, timeout || 1000);
    };

    checker(10);
  });
}

//simulator select
function iOSimulatorSelect(currentDeviceParam, device, params) {
  return new Promise(function (resolve, reject) {
    if (currentDeviceParam) {
      resolve(currentDeviceParam);
      return;
    }

    getDevicesList(device, params).then(function (device) {
      // debug(JSON.stringify(device.devices, null, 2));
      // 选择模拟器
      return selectDevices(device, params).then(resolve);
    }, function (err) {
      reject(err);
    });
  });
}

function selectDevices(device, params, callback) {
  var currentDevice, defaultType;
  // 过滤设备
  var devicesType = selected(device.devicesType, ['iPhone 4s', 'iPhone 5', 'iPhone 5s', 'iPhone 6s', 'iPhone 6', 'iPhone 6 Plus', 'iPhone 6s', 'iPhone 6s Plus', 'iPad Air', 'iPad 2']);

  for (var i = 0; i < devicesType.length; i++) {

    if (devicesType[i].indexOf('iPhone 5s') > -1) {
      defaultType = devicesType[i];
      break;
    }
  }

  var questions = [{
    'type': 'list',
    'name': 'type',
    'choices': devicesType,
    'message': 'please choose a device to open simulator',
    'default': defaultType || ''
  }];

  return inquirer.prompt(questions).then(function (answers) {
    currentDevice = device.devices[answers.type];
    return currentDevice || {};
  });
}

function selected(devicesType, names) {
  var tempDevices = [],
      i = 0,
      j = 0;

  for (; i < devicesType.length; i++) {
    for (j = 0; j < names.length; j++) {
      if (devicesType[i].split(' (')[0] == names[j]) {
        tempDevices.push(devicesType[i]);
      }
    }
  }
  return tempDevices;
}

//install app
function installiOSApp(params) {
  return new Promise(function (resolve, reject) {
    /**
     * 未执行install操作 && 非第一次创建模拟器
     * 否则将执行安装操作
     */
    var appIdentifier = params.appId,
        appPath = params.path;
    if (!fs.existsSync(appPath)) {
      console.log('target file not existed'.red);
      reject('canceled');
      return;
    }
    syncExecPromise('xcrun simctl uninstall booted ' + appIdentifier).then(function () {
      var cmd = 'xcrun simctl install booted ' + appPath;
      return syncExec(cmd);
    }).then(function () {
      console.log('install %s.app success!'.green, params.name);
      resolve();
    }).catch(function (err) {
      reject(err);
    });
  });
}

//open app
function iOSAppOpen(currentDeviceInfo, params) {
  return new Promise(function (resolve, reject) {

    var timeout = 2500;

    if (currentDeviceInfo && currentDeviceInfo.status === 'Booted') {
      timeout = 0;
    }

    console.log('Starting %s.app...'.yellow, params.name);

    setTimeout(function () {
      var cmd;

      cmd = 'xcrun simctl launch booted ' + params.appId;
      // cmd = 'xcrun simctl launch booted ' + url;
      var result = syncExec(cmd);
      if (result.stderr) {
        console.log('bundle id invalid'.red);
        reject('canceled');
        return;
      }

      console.log('%s.app launched! '.green, params.name);

      resolve();
    }, timeout);
  });
}

//util
function findCurrentDevice(devices) {
  for (var i in devices) {
    if (devices[i].status === 'Booted') {
      return devices[i];
    }
  }
  return;
}

function syncExec(command, options) {
  options = options || {};
  options.env = options.env || {
    PATH: process.env.PATH
  };

  // debug(command);

  var result = exec(command);

  result.stderr = result.stderr.replace(/\n/ig, '').trim();

  return result;
}

function syncExecPromise(command) {
  return new Promise(function (resolve, reject) {
    var std = syncExec(command),
        stdout = std.stdout,
        stderr = std.stderr;

    if (stderr) {
      reject(stderr.replace(/\n/ig, '').trim());
    } else {
      resolve(stdout);
    }
  });
}

//consolelog
function consoleLog(content, color) {
  var tipText = content;

  if ((typeof content === 'undefined' ? 'undefined' : (0, _typeof3.default)(content)) == 'object') {
    try {
      tipText = (0, _stringify2.default)(content, null, 2);
    } catch (e) {}
  }

  if (tipText == '{}') {
    tipText = content.toString();
  }

  if (color) {
    tipText = colors[color].call(tipText, tipText);
  }

  console.log(tipText);
}

module.exports = start;