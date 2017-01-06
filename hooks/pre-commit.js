#!/usr/bin/env node

/**
 * Git-hooks pre-commit 检查代码冲突
 * @author 李永凯（liyongkai@xiaoyouzi.com）
 * @log
 */

'use strict';

const execSync = require('child_process').execSync;
const isConflictRegular = "^<<<<<<<\\s|^=======$|^>>>>>>>\\s"; // 冲突文件正则表达式

let results = null;

// ref：https://github.com/zwhu/blog/issues/31
try {
  // git grep 命令会执行 perl 的正则匹配所有满足冲突条件的文件
  let results = execSync(`git grep -n -P "${isConflictRegular}"`, {
    encoding: 'utf-8'
  });
} catch (e) {
  console.log('没有发现冲突，等待 commit');
  process.exit(0);
}

if (results) {
  console.error('发现冲突，请解决后再提交，冲突文件：');
  console.error(results.trim());
  process.exit(1);
}

process.exit(0);
