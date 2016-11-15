# vscode-github README

[![Travis](https://img.shields.io/travis/KnisterPeter/vscode-github.svg)](https://github.com/KnisterPeter/vscode-github)
[![Marketplace Version](http://vsmarketplacebadge.apphb.com/version/knisterpeter.vscode-github.svg)](https://marketplace.visualstudio.com/items?itemName=KnisterPeter.vscode-github)
[![Installs](http://vsmarketplacebadge.apphb.com/installs/knisterpeter.vscode-github.svg)](https://marketplace.visualstudio.com/items?itemName=KnisterPeter.vscode-github)

This vscode extension integrates with GitHub.

## Features

Current it is possible to do the following:

* Store your GitHub Personal Access Token

To use this extension one needs to create a new GitHub Personal Access Token and registers it in the extension.
The 'GitHub: Set Personal Access Token' should be executed for that.

![GitHub Personal Access Token](images/github-personal-access-token.png)

![GitHub Personal Access Token](images/github-personal-access-token2.png)

![Set GitHub Personal Access Token](images/set-personal-access-token.png)

* Create a new pull request based on the current branch and the last commit  
  The current branch will be requested to merge into master and the pull request title is the commit message summary.

![Create pull request](images/create-pull-request.png)

* Checkout one of the open pull requests
* Browse one of the open pull requests in your default browser
* Show if the current branch has an associated pull-request on github in the status bar
* Support github https origin urls
* Refresh pull request status every 5 seconds
* Respect github caching headers
* Show status of current pull request
