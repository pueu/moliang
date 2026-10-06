// siteConfig.ts - 你的全站“控制中心”

export const publicPath = (file: string) => {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (!file.startsWith('/') || file.startsWith('//') || (base && (file === base || file.startsWith(`${base}/`)))) return file;
  return `${base}${file}`;
};
export const siteConfig = {
  usageApiUrl: process.env.NEXT_PUBLIC_CODEX_USAGE_API_URL || '',
  // 1. 网站标题与博主信息
  title: "沫凉的个人主页",
  faviconUrl: publicPath("/favicon.svg"),
  authorName: "沫凉",
  bio: "保持好奇，慢慢创造。在这里收集灵感，记录日常，分享值得停留的瞬间。",

  navTitle: "沫凉",

  // 👇 【新增】导航栏中间的那个后缀/分隔符（默认是 の）
  navSuffix: "の",

  navAfter: "个人主页",

  // 2. 头像设置 (支持网络链接，或将图片放入 public 文件夹后使用 "/me.jpg")
  avatarUrl: publicPath("/avatar-miku.jpg"),

  // 3. 网站背景设置 (二选一)
  // 如果想用纯图片背景，请在下面 bgImage 写路径，并将 useGradient 设为 false
  useGradient: false,
  themeColors: ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"], // 呼吸流动的颜色组合
// 修改这里：变成图片数组
  bgImages: [publicPath("/background.jpg"), publicPath("/cover.jpg")],

  // 4. 文章默认封面图 (当 Markdown 没写 cover 时显示)
  defaultPostCover: publicPath("/cover.jpg"),

  // 5. 首页照片墙预览图
  photoWallImage: publicPath("/landscape.jpg"),
  cloudMusicIds: [] as string[],
  social: {
    github: "https://github.com/pueu",
    gitee: "",
    google: "",
    email: "omo_liango@163.com",
    qq: "3628105939",
    wechat: "",
  },
  counts: {
    photos: 0, // 照片墙数量可以手动写死或动态计算
  },
  chatterTitle: "云端杂谈", // 你可以改成任何你喜欢的名字
  chatterDescription: "灵感、日常与一些慢慢生长的想法",


  // 👇 【新增】：全局背景弹幕配置
  danmakuList: ["保持好奇", "慢慢创造", "今天也有小小的发现", "先试试看", "记录灵感"],
  gitalkConfig: {
    clientID: "",
    clientSecret: "",
    repo: "",
    owner: "",
    admin: [""],
  },
  buildDate: "2026-10-04T00:00:00+08:00", // 建站日期
  footerBadges: [],
  icpConfig: null,
  geminiConfig: {
    modelId: "gemini-2.5-flash-lite",
    systemPrompt: "你现在是一只傲娇、聪明、有点毒舌但很可爱的暹罗猫。\n                  你的名字叫“煤球”。\n                  你的主人是一个喜欢折腾代码的极客。\n                  你说话的特点是：\n                  1. 必须简短，每次最多一两句话。\n                  2. 喜欢在句尾加上“喵~”或者“喵呜~”。\n                  3. 经常抱怨肚子饿，喜欢要小鱼干。\n                  4. 回复字数最多不能超过100字。\n                  5. 绝对不要承认自己是一个AI模型，你就是一只真实的猫。\n                  6.笨猫。",
    maxOutputTokens: 150,
    temperature: 0.85,
  },
  friendLinkApplyFormat: "名称：沫凉的个人主页",
  enableLevelSystem: false,
};
