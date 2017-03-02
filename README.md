# git-hooks-node [![npm version badge](https://badge.fury.io/js/git-hooks-node.svg)](https://www.npmjs.com/package/git-hooks-node) [![travis badge](https://travis-ci.org/yangjiqiao86/git-hooks-node.svg)](https://travis-ci.org/yangjiqiao86/git-hooks-node) [![downloads badge](http://img.shields.io/npm/dm/git-hooks-node.svg)](http://img.shields.io/npm/dm/git-hooks-node.svg)

> Allows you to use nodejs write git-hooks


## Install

```sh
npm install git-hooks-node --save-dev
```

```javascript
// Edit package.json
{
  "scripts": {
    "prepushtag": "npm run publish",
    "prepushbranch": "npm run test",
    "...": "..."
  }
}
```


## Uninstall

```bash
npm uninstall git-hooks-node --save-dev
```

## Thank you for

- [husky](https://github.com/typicode/husky)
