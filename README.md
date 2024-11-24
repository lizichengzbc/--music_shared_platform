# 音乐分享平台-jj20 music share platform
哈哈哈哈哈 这个项目主要是作者用来学习web开发经验用的，第一次做这种项目......
可能做的不是很好，有什么意见的可以在issue跟我讲一下~（看见了都会回复的）

这个项目是用flask框架进行实现，功能其实还没有很多，环境部署也不会很难，下面是一些基本的环境部署的方法：

1. 创建虚拟环境
运行以下命令创建一个新的虚拟环境：

python -m venv myenv
这里，myenv 是虚拟环境的名称，你可以自定义。

2. 激活虚拟环境
根据你的操作系统，使用对应的命令激活虚拟环境：

Windows
在 cmd 或 PowerShell 中：
myenv\Scripts\activate
如果使用的是 Git Bash 或其他类似的终端：
source myenv/Scripts/activate
macOS/Linux
在终端中运行：
source myenv/bin/activate

3. 验证虚拟环境是否激活
激活后，命令行提示符会显示虚拟环境的名称，例如：

(myenv) $
运行以下命令，确认 Python 使用的是虚拟环境中的版本：

which python  # macOS/Linux
where python  # Windows
4. 退出虚拟环境
要退出虚拟环境，运行以下命令：

deactivate
这样，你就回到了全局环境。

常见问题
如果激活失败，检查是否安装了 virtualenv 或 venv：

pip install virtualenv  # 如果需要
如果在 Windows 上 PowerShell 报错，可能需要更改执行策略：
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
