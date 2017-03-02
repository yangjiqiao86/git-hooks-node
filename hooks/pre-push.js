#!/usr/bin/env node

/**
 * git push 之前完成一些校验工作以及推送branch、推送tag之前做一些事
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Q = require('q');
const exec = require('child_process').exec;
const chalk = require('chalk');
const yargs = require('yargs');
const shell = require('shelljs');

const argv = yargs.usage('Usage: node pre-push.js [options]')
  .example('node ./hooks/pre-push.js --cn --cv --tagpush \"npm run publish\" --branchpush \"npm run test\"')
  .options({
    cn: {
      alias: 'checkpkgname',
      describe: 'package 项目名称是否开启校验[true|false]，校验规则：npm_package_name等于当前项目目录名称',
      boolean: true
    },
    cv: {
      alias: 'checkpkgversion',
      describe: 'package 项目版本是否开启校验[true|false]，校验规则：npm_package_version等于当前所在git分支版本号，git分支名称形如[dx.y.z]或[vx.y.z]，例：d1.0.0 或 v1.0.0 取到版本号：1.0.0',
      boolean: true
    },
    tagpush: {
      alias: 'ontagpushexec',
      describe: 'push tag 之前执行命令行，tag格式必须为[vx.y.z]格式，如v1.0.0',
      type: 'string'
    },
    branchpush: {
      alias: 'onbranchpushexec',
      describe: 'push branch 之前行命令行，branch格式必须为[dx.y.z]格式，如d1.0.0',
      type: 'string'
    }
  })
  .help('h')
  .alias('h', 'help')
  .epilog('copyright 2017')
  .argv;

const checkpkgname = argv.checkpkgname;
const checkpkgversion = argv.checkpkgversion;
const ontagpushexec = argv.ontagpushexec;
const onbranchpushexec = argv.onbranchpushexec;

// console.log(chalk.cyan('checkpkgname：' + checkpkgname));
// console.log(chalk.cyan('checkpkgversion：' + checkpkgversion));
// console.log(chalk.cyan('ontagpushexec：' + ontagpushexec));
// console.log(chalk.cyan('onbranchpushexec：' + onbranchpushexec));

const regTag = /^[v]{1}\d+\.\d+\.\d+$/; // tag格式，例：v1.0.0
const regBranch =/^[d]{1}\d+\.\d+\.\d+$/; // branch格式，例：d1.0.0

/**
 * 构造器函数
 * @param {Object} options 配置参数
 * @param {Object} options checkpkgname 是否校验项目名称
 * @param {Object} options checkpkgversion 是否校验项目版本
 * @param {Object} options ontagpushexec push tag 成功之后执行命令行
 * @param {Object} options onbranchpushexec branch tag 成功之后执行命令行
 */
function Package(options) {
  this.options = options || {};
  this.init();
}

/**
 * 初始化方法
 */
Package.prototype.init = function() {
  this.checkPkgName();
  this.getBranchName()
    .then(this.checkBranchName)
    .then((data) => {
      this.checkPkgVersion(data);
      this.onTagPushedExec(data);
      this.onBranchPushedExec(data);
    })
    .catch((error) => {
      console.log(chalk.red(error));
    });
};

/**
 * 获取当前所在Git分支名称
 * @return {Object} Promise对象
 */
Package.prototype.getBranchName = function() {
  let deferred = Q.defer();

  // https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
  exec('git symbolic-ref --short HEAD', (error, stdout, stderr) => {
    if (error) {
      deferred.reject(error);
    } else {
      deferred.resolve((stdout || '').trim());
    }
  });

  return deferred.promise;
};

/**
 * 检测Git分支名称是否tag格式或branch格式
 * @param  {String} branchName Git分支名称
 * @return {Object}            Promise对象
 */
Package.prototype.checkBranchName = function(branchName) {
  let isTag = regTag.test(branchName);
  let isBranch = regBranch.test(branchName);

  // {"isTag":false,"isBranch":true,"branchName":"d0.0.1","branchVersion":"0.0.1"}
  if (isTag || isBranch) {
    return {
      isTag: isTag,
      isBranch: isBranch,
      branchName: branchName,
      branchVersion: branchName.match(/\d+\.\d+\.\d/)[0]
    };
  } else {
    console.log(chalk.red('当前Git分支名称不合法[dx.y.z]或[vx.y.z]，请切换到对应的版本分支。例：d1.0.0或v1.0.0'));
    process.exit(1);
  }
};


/**
 * 检测package项目名称和当前项目目录名称是否一致
 */
Package.prototype.checkPkgName = function() {
  if (!this.options.checkpkgname) return;

  let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  let projectName = path.basename(path.resolve(__dirname, '../'));

  if (pkg.name !== projectName) {
    pkg.name = projectName;
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log(chalk.yellow('package.json => name 字段与当前所在项目名称不一致，已自动修改为：' + projectName));
  }
};

/**
 * 检测package版本号和当前Git分支版本号是否一致
 * @param {Object} data 分支数据
 */
Package.prototype.checkPkgVersion = function(data) {
  if (!this.options.checkpkgversion) return;

  let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  if (pkg.version !== data.branchVersion) {
    pkg.version = data.branchVersion;
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log(chalk.yellow('package.json => version 字段与当前所在Git分支版本号不一致，已自动修改为：' + data.branchVersion));
    process.exit(0);
  }
};

/**
 * push tag 之前执行命令行
 * @param {Object} data 分支数据
 */
Package.prototype.onTagPushedExec = function(data) {
  if (!this.options.ontagpushexec || !data.isTag) return;

  shell.exec(this.options.ontagpushexec, (code, stdout, stderr) => {
    if (code === 0) {
      console.log(chalk.green('ontagpushexec success'));
    } else {
      console.log(chalk.red('ontagpushexec failure'));
    }
  });
};

/**
 * push branch 之前行命令行
 * @param {Object} data 分支数据
 */
Package.prototype.onBranchPushedExec = function(data) {
  if (!this.options.onbranchpushexec || !data.isBranch) return;

  shell.exec(this.options.onbranchpushexec, (code, stdout, stderr) => {
    if (code === 0) {
      console.log(chalk.green('onbranchpushexec success'));
    } else {
      console.log(chalk.red('onbranchpushexec failure'));
    }
  });
};

return new Package({
  checkpkgname: checkpkgname,
  checkpkgversion: checkpkgversion,
  ontagpushexec: ontagpushexec,
  onbranchpushexec: onbranchpushexec
});
