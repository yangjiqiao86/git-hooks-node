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

/**
 * 构造器函数
 */
function PrePush() {
  this.init();
}

/**
 * 初始化方法
 */
PrePush.prototype.init = function() {
  this.checkPkgName();
  this.getBranchName()
    .then(this.checkBranchName)
    .then((data) => {
      this.checkPkgVersion(data);
      this.prePushTag(data);
      this.prePushBranch(data);
    })
    .catch((error) => {
      console.log(chalk.red(error));
    });
};

/**
 * 获取当前所在Git分支名称
 * @return {Object} Promise对象
 */
PrePush.prototype.getBranchName = function() {
  let deferred = Q.defer();

  // https://git-scm.com/book/zh/v1/Git-%E5%86%85%E9%83%A8%E5%8E%9F%E7%90%86-Git-References
  // http://stackoverflow.com/questions/27615126/print-symbolic-name-for-head
  // https://stackoverflow.com/questions/6245570/how-to-get-the-current-branch-name-in-git
  // git symbolic-ref --short HEAD
  // git symbolic-ref -q --short HEAD || git name-rev --name-only HEAD
  // git symbolic-ref -q --short HEAD || git describe --all --always HEAD
  // git symbolic-ref HEAD
  // git rev-parse --abbrev-ref HEAD
  // git branch | sed -n '/\* /s///p'
  // git describe --all
  // git branch | grep \* | cut -d ' ' -f2-
  // git branch | sed -n '/\* /s///p'
  // git reflog HEAD | grep 'checkout:' | head -1 | awk '{print $NF}'
  // git reflog | awk '$3=="checkout:" {print $NF; exit}'
  // git status | head -1
  // git status | head -1 | awk '{print $NF}'
  // 上面的方法亲测，除最后一个方法没有测出问题之外，其它方法或多或少都有问题
  exec("git status | head -1 | awk '{print $NF}'", (error, stdout, stderr) => {
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
PrePush.prototype.checkBranchName = function(branchName) {
  let regTag = /^[v]{1}\d+\.\d+\.\d+$/; // tag格式，例：v1.0.0
  let regBranch =/^[d]{1}\d+\.\d+\.\d+$/; // branch格式，例：d1.0.0
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
PrePush.prototype.checkPkgName = function() {
  let pkgName = process.env.npm_package_name;
  let projectName = path.basename(path.resolve(__dirname, '../'));

  if (pkgName !== projectName) {
    let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.name = projectName;
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log(chalk.yellow('npm_package_name 字段与当前所在项目名称不一致，已自动修改为：' + projectName));
    process.exit(0);
  }
};

/**
 * 检测package版本号和当前Git分支版本号是否一致
 * @param {Object} data 分支数据
 */
PrePush.prototype.checkPkgVersion = function(data) {
  let pkgVersion = process.env.npm_package_version;

  if (pkgVersion !== data.branchVersion) {
    let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.version = data.branchVersion;
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log(chalk.yellow('npm_package_version 字段与当前所在Git分支版本号不一致，已自动修改为：' + data.branchVersion));
    process.exit(0);
  }
};

/**
 * push tag 之前执行命令行
 * @param {Object} data 分支数据
 */
PrePush.prototype.prePushTag = function(data) {
  let command = process.env.npm_package_scripts_prepushtag;

  if (!command || !data.isTag) return;

  shell.exec('npm run prepushtag', (code, stdout, stderr) => {
    if (code === 0) {
      console.log(chalk.green('npm run prepushtag success'));
    } else {
      console.log(chalk.red('npm run prepushtag failure'));
    }
  });
};

/**
 * push branch 之前行命令行
 * @param {Object} data 分支数据
 */
PrePush.prototype.prePushBranch = function(data) {
  let command = process.env.npm_package_scripts_prepushbranch;

  if (!command || !data.isBranch) return;

  shell.exec('npm run prepushbranch', (code, stdout, stderr) => {
    if (code === 0) {
      console.log(chalk.green('npm run prepushbranch success'));
    } else {
      console.log(chalk.red('npm run prepushbranch failure'));
    }
  });
};

return new PrePush();
