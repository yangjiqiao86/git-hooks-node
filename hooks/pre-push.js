#!/usr/bin/env node

/**
 * 在 git push 命令完成之前做一些事
 * > 1. 校验 npm_package_name，必须和所在项目目录名称保持一致
 * > 2. 校验 npm_package_version，必须和当前所在Git分支版本号保持一致
 * > 3. 推送 branch、推送 tag之前运行用户在npm_package_scripts配置的prepushtag、prepushbranch命令行
 * > 4. push tag成功之后自动合并代码至远端master分支并删除远端对应开发分支
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Q = require('q');
const exec = require('child_process').exec;
const chalk = require('chalk');
const yargs = require('yargs');
const shell = require('shelljs');

const regTag = /^[v]{1}\d+\.\d+\.\d+$/; // tag格式，例：v1.0.0
const regBranch =/^[d]{1}\d+\.\d+\.\d+$/; // branch格式，例：d1.0.0
const regMaster = /^master$/; // master分支
const regVersion = /\d+\.\d+\.\d/; // 获取tag、branch版本号

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
  this.getBranchData()
    .then((data) => {
      this.checkBranchName(data);
      this.checkPkgVersion(data);
      this.prePushTag(data);
      this.prePushBranch(data);
    })
    .catch((error) => {
      console.log(chalk.red(error));
    });
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
    process.exit(1);
  }
};

/**
 * 获取当前所在Git分支数据
 * @return {Object} Promise对象
 */
PrePush.prototype.getBranchData = function() {
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
      // deferred.resolve((stdout || '').trim());
      let branchName = (stdout || '').trim();
      let branchVersion = branchName.match(regVersion) ? branchName.match(regVersion)[0] : '';
      let isTag = regTag.test(branchName);
      let isBranch = regBranch.test(branchName);
      let isMaster = regMaster.test(branchName);

      deferred.resolve({
        isTag: isTag,
        isBranch: isBranch,
        isMaster: isMaster,
        branchName: branchName,
        branchVersion: branchVersion
      });
    }
  });

  return deferred.promise;
};

/**
 * 检测Git分支是否标准tag格式或标准branch格式
 * @param {Object} data 分支数据
 */
PrePush.prototype.checkBranchName = function(data) {
  // {"isTag":false,"isBranch":true,"isMaster":false,"branchName":"d0.0.1","branchVersion":"0.0.1"}
  if (!data.isTag && !data.isBranch && !data.isMaster) {
    console.log(chalk.red('当前Git分支名称不合法[dx.y.z]或[vx.y.z]，请切换到对应的版本分支。例：d1.0.0或v1.0.0'));
    process.exit(1);
  }
};

/**
 * 检测package版本号和当前Git分支版本号是否一致
 * @param {Object} data 分支数据
 */
PrePush.prototype.checkPkgVersion = function(data) {
  if (data.isMaster) return; // master分支不在进行版本号校验

  let pkgVersion = process.env.npm_package_version;

  if (pkgVersion !== data.branchVersion) {
    let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.version = data.branchVersion;
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log(chalk.yellow('npm_package_version 字段与当前所在Git分支版本号不一致，已自动修改为：' + data.branchVersion));
    process.exit(1);
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
      this.autoMergeMaster(data);
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

/**
 * 自动合并代码至master分支
 * @param {Object} data 分支数据
 */
PrePush.prototype.autoMergeMaster = function(data) {
  // 分支操作：http://zengrong.net/post/1746.htm
  let command = [
    'git checkout master',
    'git pull origin master',
    'git merge ' + data.branchName,
    'git push origin master',
    'git push origin --delete d' + data.branchVersion
  ].join(' && ');

  console.log(chalk.cyan('开始合并代码至master分支'));
  shell.exec(command, function(code, stdout, stderr) {
    if (code == 0) {
      console.log(chalk.cyan('master分支代码合并成功'));
    } else {
      console.log(chalk.red('master分支代码合并失败'));
    }
  });
};

return new PrePush();
