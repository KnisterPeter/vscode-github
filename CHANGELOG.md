# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="0.7.1"></a>
## [0.7.1](https://github.com/KnisterPeter/vscode-github/compare/v0.7.0...v0.7.1) (2016-11-29)


### Bug Fixes

* correctly obtain Git remote and parse it (#38) ([adb243b](https://github.com/KnisterPeter/vscode-github/commit/adb243b))



<a name="0.7.0"></a>
# [0.7.0](https://github.com/KnisterPeter/vscode-github/compare/v0.6.0...v0.7.0) (2016-11-18)


### Bug Fixes

* do not create pull request on default branch ([d6e1a8a](https://github.com/KnisterPeter/vscode-github/commit/d6e1a8a))
* leverage github default branch ([#22](https://github.com/KnisterPeter/vscode-github/issues/22)) ([693da3f](https://github.com/KnisterPeter/vscode-github/commit/693da3f))


### Features

* display only enabled merge methods ([#23](https://github.com/KnisterPeter/vscode-github/issues/23)) ([b1ef991](https://github.com/KnisterPeter/vscode-github/commit/b1ef991))



<a name="0.6.0"></a>
# [0.6.0](https://github.com/KnisterPeter/vscode-github/compare/v0.5.0...v0.6.0) (2016-11-17)


### Bug Fixes

* handling of headers ([589ba74](https://github.com/KnisterPeter/vscode-github/commit/589ba74))

### Features

* add configuration for default branch ([12867be](https://github.com/KnisterPeter/vscode-github/commit/12867be))
* add configuration for prefered merge method ([5b826a4](https://github.com/KnisterPeter/vscode-github/commit/5b826a4))
* add configuration for refresh interval ([911fbd6](https://github.com/KnisterPeter/vscode-github/commit/911fbd6))
* enable support for squash and rebase merges ([8409d61](https://github.com/KnisterPeter/vscode-github/commit/8409d61))



<a name="0.5.0"></a>
# [0.5.0](https://github.com/KnisterPeter/vscode-github/compare/v0.4.0...v0.5.0) (2016-11-15)


### Features

* add merge button (currently no squash and rebase) ([12ead05](https://github.com/KnisterPeter/vscode-github/commit/12ead05))



<a name="0.4.0"></a>
# [0.4.0](https://github.com/KnisterPeter/vscode-github/compare/v0.3.0...v0.4.0) (2016-11-15)


### Features

* add information message on first startup ([f336239](https://github.com/KnisterPeter/vscode-github/commit/f336239))



<a name="0.3.0"></a>
# [0.3.0](https://github.com/KnisterPeter/vscode-github/compare/v0.2.2...v0.3.0) (2016-11-15)


### Bug Fixes

* **vscode-github:** detect current branch (#14) ([7c0724b](https://github.com/KnisterPeter/vscode-github/commit/7c0724b))
* **vscode-github:** show status bar only if github project (#10) ([42f6abb](https://github.com/KnisterPeter/vscode-github/commit/42f6abb))
* **vscode-github:** update command texts ([8649cc0](https://github.com/KnisterPeter/vscode-github/commit/8649cc0))

### Features

* **vscode-github:** add status-bar icon for pull-request (#9) ([260cf5f](https://github.com/KnisterPeter/vscode-github/commit/260cf5f))
* **vscode-github:** allow https-origin for github detection (#16) ([e764751](https://github.com/KnisterPeter/vscode-github/commit/e764751))
* **vscode-github:** lazy initialize extension (#7) ([12cd5b7](https://github.com/KnisterPeter/vscode-github/commit/12cd5b7))
* **vscode-github:** refresh pull-request status every 5 seconds (#15) ([51a81b1](https://github.com/KnisterPeter/vscode-github/commit/51a81b1))
* **vscode-github:** respect etag header from github (#12) ([62f1e54](https://github.com/KnisterPeter/vscode-github/commit/62f1e54))
* **vscode-github:** show notification on success (#8) ([4359f6c](https://github.com/KnisterPeter/vscode-github/commit/4359f6c))
* **vscode-github:** show status of current pull request (#17) ([18f9535](https://github.com/KnisterPeter/vscode-github/commit/18f9535))



<a name="0.2.2"></a>
## [0.2.2](https://github.com/KnisterPeter/vscode-github/compare/v0.2.1...v0.2.2) (2016-11-09)




<a name="0.2.1"></a>
## [0.2.1](https://github.com/KnisterPeter/vscode-github/compare/v0.2.0...v0.2.1) (2016-11-09)




<a name="0.2.0"></a>
# [0.2.0](https://github.com/KnisterPeter/vscode-github/compare/v0.1.1...v0.2.0) (2016-11-09)


### Bug Fixes

* **vscode-github:** current branch detection ([719e908](https://github.com/KnisterPeter/vscode-github/commit/719e908))
* **vscode-github:** stabilized input of personal access token (#3) ([f7735fc](https://github.com/KnisterPeter/vscode-github/commit/f7735fc))

### Features

* **vscode-github:** add debug/error channel ([9c20ffe](https://github.com/KnisterPeter/vscode-github/commit/9c20ffe))



<a name="0.1.1"></a>
## [0.1.1](https://github.com/knisterpeter/vscode-github/compare/v0.1.0...v0.1.1) (2016-11-09)




<a name="0.1.0"></a>
# 0.1.0 (2016-11-09)


### Features

* **vscode-github:** create pull-requests and checkout pull-requests ([d350488](https://github.com/knisterpeter/vscode-github/commit/d350488))
* **vscode-github:** list pull-requests ([db195b7](https://github.com/knisterpeter/vscode-github/commit/db195b7))
* **vscode-github:** select a pull-request ([3574016](https://github.com/knisterpeter/vscode-github/commit/3574016))
