'use strict';

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var Q = require('q');
var chalk = require('chalk');
var fsUtils = require("nodejs-fs-utils");
var hooksDir = path.join(__dirname, '..');
var projectDir = path.join(__dirname, '..', '..', '..');

// Hooks Map
// Git hook | Npm script
var hooksMap = {
  // applypatchmsg: 'applypatch-msg',
  // commitmsg: 'commit-msg',
  // postapplypatch: 'post-applypatch',
  // postcheckout: 'post-checkout',
  // postcommit: 'post-commit',
  // postmerge: 'post-merge',
  // postreceive: 'post-receive',
  // postrewrite: 'post-rewrite',
  // postupdate: 'post-update',
  // preapplypatch: 'pre-applypatch',
  // preautogc: 'pre-auto-gc',
  // precommit: 'pre-commit',
  prepush: 'pre-push'
  // prerebase: 'pre-rebase',
  // prereceive: 'pre-receive',
  // preparecommitmsg: 'prepare-commit-msg',
  // pushtocheckout: 'push-to-checkout',
  // update: 'update',
};

/**
 * 复制hooks目录至项目目录
 */
function copyHooks() {
  let deferred = Q.defer();

  fsUtils.copy(hooksDir + '/hooks', projectDir + '/hooks', function(error, cache) { // copy file or folders
    if (!error) {
      console.log(chalk.cyan('Hooks copied!'));
      deferred.resolve();
    } else {
      deferred.reject(error);
    }
  });

  return deferred.promise;
}

/**
 * 添加Npm scripts
 */
function addNpmScripts() {
  let deferred = Q.defer();
  let projectPkg = path.join(projectDir, 'package.json');

  if (fs.existsSync(projectPkg)) {
    let errors = [];
    let pkg = JSON.parse(fs.readFileSync(projectPkg, 'utf8'));
    let scripts = pkg.scripts || {};

    for (let key in hooksMap) {
      if (hooksMap.hasOwnProperty(key)) {
        let command = 'node ./hooks/' + hooksMap[key] + '.js';

        if (!scripts[key]) {
          scripts[key] = command;
        } else {
          if (!scripts[key].match(command)) {
            scripts[key] += ' && ' + command;
          } else {
            errors.push('Script ' + key + ' is already exists!\n');
          }
        }
      }
    }

    fs.writeFileSync(projectPkg, JSON.stringify(pkg, null, 2));
    console.log(chalk.cyan('Npm scripts added!'));

    if (errors.length) {
      deferred.reject(errors.join(''));
    } else {
      deferred.resolve();
    }
  } else {
    deferred.reject('Could not find package.json!');
  }

  return deferred.promise;
}

copyHooks()
  .then(addNpmScripts)
  .then(() => {
    console.log(chalk.green('Hooks install success!'));
  })
  .catch((error) => {
    console.log(chalk.red(error));
  });
