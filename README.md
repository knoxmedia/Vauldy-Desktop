# Vauldy Desktop

Vauldy Desktop 是 [Vauldy](https://github.com/knoxmedia/Vauldy) 自托管媒体服务器的跨平台桌面客户端，基于 **Tauri 2、React 19、TypeScript 和 mpv** 构建。

当前版本：**v0.1.0（Phase 1 MVP）**

[下载最新版本](https://github.com/knoxmedia/Vauldy-Desktop/releases) · [查看更新日志](CHANGELOG.md) · [桌面端需求规格书](doc/桌面端需求规格书.md)

## 功能概览

### 媒体浏览

- 配置 Vauldy 服务器地址并通过 JWT 登录
- 首页展示媒体库、继续观看和最近添加内容
- 浏览和搜索电影、电视剧、动漫、音乐、照片及文档
- 查看媒体元数据、演职人员、字幕和编码信息
- 管理收藏、收藏文件夹、播放列表及播放历史
- 保存播放和阅读进度，支持断点续播

### 视频与音乐播放

- 通过 **mpv sidecar** 提供原生视频和音频播放能力
- Windows 支持嵌入主窗口的视频画面
- 支持播放、暂停、跳转、音量调节和播放状态同步
- 根据媒体编码、HDR、位深和字幕格式自动选择播放引擎
- 支持 HTML5 与 hls.js 播放回退
- 支持电视剧、动漫和播放列表连续播放
- 支持专辑、艺术家、流派浏览及歌词显示

### 照片与文档

- 照片灯箱、缩略图预览和原图下载
- 按标签、地点和人物浏览照片
- 阅读 PDF、EPUB 及 Office 文档
- 保存阅读进度并编辑文档元数据

### 桌面体验

- 关闭窗口时最小化到系统托盘
- 通过托盘菜单显示主窗口或退出应用
- 从服务端同步应用名称、图标和界面语言
- 支持简体中文、繁体中文、英语、日语和韩语

## 平台支持

| 平台 | 架构 | 视频窗口 | 构建方式 |
|---|---|---|---|
| Windows | x64 | mpv 嵌入式窗口 | `build.ps1` 或 `npm run tauri:build` |
| Linux | x64 | 独立 mpv 窗口 | 在 Linux 主机上构建 |
| macOS | Intel / Apple Silicon | 独立 mpv 窗口 | 在对应 macOS 主机上构建 |

> mpv 嵌入式窗口目前依赖 Win32 API。Linux 和 macOS 版本使用独立 mpv 窗口。

## 安装与使用

使用桌面客户端前，需要先部署并运行兼容 API v1 的 Vauldy Media Server。

1. 从 [GitHub Releases](https://github.com/knoxmedia/Vauldy-Desktop/releases) 下载对应平台的安装包。
2. 安装并启动 Vauldy Desktop。
3. 输入服务器地址，例如 `http://127.0.0.1:8200`。
4. 使用 Vauldy 账户登录并选择媒体库。

## 本地开发

### 环境要求

| 工具 | 要求 |
|---|---|
| Node.js | 20+ |
| Rust | stable（运行或构建 Tauri 应用时需要） |
| mpv | 安装到 `PATH`，或准备对应平台的 sidecar |
| Vauldy Server | 可访问的 API v1 服务 |

### 启动项目

```bash
npm install

# 仅启动前端界面，使用 HTML5 播放器
npm run dev

# 启动完整桌面应用，需要 Rust 和 mpv
npm run tauri:dev
```

Vite 开发服务器默认运行在 `http://localhost:1420`。

## mpv Sidecar

Tauri 打包时需要将平台对应的 mpv 可执行文件放入 `src-tauri/bin/`，并使用目标三元组命名：

```text
src-tauri/bin/
├── mpv-x86_64-pc-windows-msvc.exe
├── mpv-x86_64-unknown-linux-gnu
├── mpv-x86_64-apple-darwin
└── mpv-aarch64-apple-darwin
```

开发环境也可以直接使用系统 `PATH` 中的 `mpv`。Windows 用户可运行以下脚本自动下载 sidecar：

```powershell
.\scripts\download-mpv.ps1
```

## 构建

### 当前平台

```bash
npm install
npm run tauri:build
```

Windows 可使用辅助脚本下载 mpv、构建应用并收集产物：

```powershell
.\build.ps1
```

构建输出：

```text
src-tauri/target/release/          可执行文件
src-tauri/target/release/bundle/   平台安装包
dist/desktop/<target-triple>/      build.ps1 收集的 Windows 构建产物
```

Tauri 不支持从单一主机直接生成所有平台安装包。Linux 和 macOS 版本需要使用对应平台的原生工具链构建。

## 项目结构

```text
src/                 React 桌面前端、路由、状态和 API 客户端
src-tauri/           Tauri/Rust 桌面壳、mpv IPC、托盘和窗口管理
scripts/             构建及 mpv 下载脚本
doc/                 桌面端需求规格书
CHANGELOG.md          版本更新记录
```

本仓库也作为 Git 子模块集成在 Vauldy 主项目的 `Vauldy-Desktop/` 目录中。

## 已知限制

- mpv 嵌入式视频窗口目前仅支持 Windows
- 管理功能目前主要复用 Vauldy Web UI
- 暂不支持从桌面客户端上传本地媒体
- 暂不支持完整离线缓存和离线播放
- 暂不支持画中画或独立播放器窗口
- 暂无硬件解码配置界面，mpv 默认使用 `--hwdec=auto`
- 暂不支持配置开机自动启动

更多版本信息请参阅 [CHANGELOG.md](CHANGELOG.md)。

## 技术栈

- Tauri 2 / Rust
- React 19 / TypeScript
- Ant Design 6
- Zustand
- React Router 7
- i18next / react-i18next
- Axios
- hls.js
- mpv / JSON IPC
- Vite 6

## 相关项目

- [Vauldy Server](https://github.com/knoxmedia/Vauldy)
- [Vauldy Mobile](https://github.com/knoxmedia/Vauldy-ReactNative)
- [Desktop SRS](doc/桌面端需求规格书.md)
