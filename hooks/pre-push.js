#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const Q = require('q');
const exec = require('child_process').exec;
const chalk = require('chalk');

/**
 * 构造器函数
 */
function Package() {
  this.init();
}

/**
 * 初始化方法
 */
Package.prototype.init = function() {
  this.checkName();
  this.checkVersion();
};

/**
 * 检测项目名称（package.json中name字段等于项目目录名称）
 */
Package.prototype.checkName = function() {
  let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  let rootDir = path.resolve(__dirname, '../');
  let projectName = path.basename(rootDir);

  if (pkg.name !== projectName) {
    pkg.name = projectName;
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log(chalk.yellow('package.json => name 字段与当前所在项目名称不一致，已自动修改为：' + projectName));
  }
};

/**
 * 检测项目版本（package.json中version字段等于Git对支对应版本）
 */
Package.prototype.checkVersion = function() {
  this.getBranchName()
    .then(this.checkBranchName)
    .then(this.checkPkgVersion)
    .catch((error) => {
      chalk.red(error)
    });
};

/**
 * 获取Git分支版本号
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
 * 检测Git分支名称是否合法，例：d1.0.0 或者 v1.0.0
 * @param  {String} branchName Git分支名称
 * @return {Object}            Promise对象
 */
Package.prototype.checkBranchName = function(branchName) {
  let deferred = Q.defer();

  if (!branchName.match(/^[dv]{1}\d+\.\d+\.\d+$/)) { // Git分支名称非d1.0.0 或者 v1.0.0格式
    console.log(chalk.red('当前Git分支名称不合法[dx.y.z]或[vx.y.z]，请切换到对应的版本分支。例：d1.0.0或v1.0.0'));
    process.exit(1);
  } else {
    deferred.resolve(branchName.replace(/[dv]/, ''));
  }

  return deferred.promise;
};

/**
 * 检测package版本号和当前Git分支版本号是否一致
 * @param {String} branchVersion Git分支版本号
 */
Package.prototype.checkPkgVersion = function(branchVersion) {
  let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  if (pkg.version !== branchVersion) {
    pkg.version = branchVersion;
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log(chalk.yellow('package.json => version 字段与当前所在Git分支版本号不一致，已自动修改为：' + branchVersion));
    process.exit(0);
  }
};

return new Package();
