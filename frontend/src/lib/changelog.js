// 更新日志（Changelog）数据与纯函数。
//
// 设计取舍：
// 1) 纯数据 + 纯函数，**零 import**。这样 Node 可以直接 import 它做离线单测
//    （见 frontend/tests/changelog.probe.mjs），不需要浏览器环境，也不需要装依赖。
// 2) 形式定为「按版本分组的发布说明（release notes）」：每一版一张卡片，
//    变更按 新增 / 改进 / 修复 / 移除 四类分组。比一条条流水账更好扫读，
//    也比「只有一个大列表」更容易按类型筛选。
// 3) 数组本身**已经按日期倒序**排好（最新在最前）。同一日期内按真实发生的先后
//    倒序排列；sortVersions() 用的是稳定排序，所以同日期条目的相对顺序不会被打乱。
// 4) 数据来自 docs/progress.md 与 docs/removed-features.md 的真实开发记录，
//    不是编造的。2026-10-06 / 10-07 两轮按大阶段合并，10-09 起逐轮记录。

/** 版本列表：按日期倒序（最新在最前） */
export const CHANGELOG = [
  {
    version: 'v0.11.0',
    date: '2026-10-12',
    title: '图展拆成图片 + 动态壁纸两区 + 移除全屏过场动画 + 图书只支持 EPUB/PDF',
    summary: '图展（原「图片展览」）拆成「静态图片」与「动态壁纸」两个区：图片不再一股脑全铺，默认只显示 4 行、点「查看更多」才展开；动态壁纸是站长上传的短视频（MP4 / WebM），在页面里静音循环播放，R2 里与静态图片分开存（wallpapers/ 与 assets/ 两个前缀）。页面跳转的全屏过场动画整体移除，点击后直接进入新页面（页面本身保留轻微淡入上浮）；图书只保留 EPUB 与 PDF 两种可在站内阅读的格式，MOBI / AZW3 从前端到上传白名单一并撤掉；站长本人登录后收藏页不再重复显示一份「站长收藏」，只保留自己那一份。首页方面：首屏文案定为「把散落的碎片 / 收进一张星图」并单独成一条标题带（逐字升起 + 手绘下划线 + 实时时钟），渐变 Dora Studio 字标挪到「此刻」区铁屑卡片左上角；书架改成与首页轮播图同宽的全幅书架；「站点构成」换成多彩鲜艳配色，音乐与影视计数修好（之前一直显示 0）。此外新增「共创」页与站长端反馈收件箱，音乐页新增黑胶 + 实时歌词页并扩了音源（新增酷我官方这一路，搜索与取流实测 8/8 可用），全站加上无固定时长的页面加载进度条，影视卡按钮与播放代理兼容一并修好，全站字体收口到同一套 UI 字面。',
    changes: [
      { type: 'feat', text: '图展新增「动态壁纸」区：站长在策展抽屉里上传 MP4 / WebM 短视频，前端静音循环播放，点击原地放大（带取消静音与进度条）；R2 里动态壁纸走 wallpapers/ 前缀，与静态图片的 assets/ 前缀分开存，互不牵连' },
      { type: 'feat', text: '图展的图片不再一股脑全铺：默认只显示 4 行，点「查看更多」展开全部、再点变「收起」；动态壁纸区同理' },
      { type: 'fix', text: '修好图展图片「排版很不协调」的问题：原来是 CSS 瀑布流，各列高度不齐、底部留一大块空档，宽高比差异一大就乱；现在改成「整齐等高行」——每一行图片等高、整行铺满容器宽度，行距统一，按整行折叠（不会在行中间断开留半截图）' },
      { type: 'fix', text: '修好图展动态壁纸「无法在线预览」的问题：视频标签带不了登录凭证，私人壁纸一律 404；现在读取类接口支持一次性媒体令牌，图片与视频都能正常显示' },
      { type: 'feat', text: '图展策展抽屉新增「一键公开全部」：静态图片与动态壁纸各一个按钮，一次把该区所有未公开的条目设为公开，不用一条条点' },
      { type: 'fix', text: '修好图书阅读器「滑到底之后继续滑没反应」的问题：现在向右滑 / 向下滑翻到下一章，向左滑 / 向上滑翻回上一章；章节内仍可正常上下滚动，滚到尽头再继续滑才翻章，短章节直接翻章' },
      { type: 'improve', text: '音乐与影视的搜索历史从「和搜索框同一行的右侧」挪到**搜索框正下方**，并且「一键清空」单独占一行靠右，不再和搜索词挤在一起' },
      { type: 'improve', text: '共创页的迷你星体从段落下方居中改成贴在介绍文字**右侧**，高度与那段文字齐平；窄屏自动落回上下堆叠' },
      { type: 'feat', text: '底部播放条按《Nacre 音乐》模板补齐了播放相关的全部入口，不再为它们另开页面：点封面**立即**进歌词页，新增收藏按钮、随机播放开关、顺序 / 列表循环 / 单曲循环（单曲循环带角标 1），「下一曲」右边加了播放队列按钮，点了就地弹出队列浮层、可直接切歌' },
      { type: 'improve', text: '播放顺序改成显式的顺序表：随机播放时「上一首」能真的回到刚才听过的那一首（不是每次重新随机），列表循环放完回到第一首，单曲循环播完重播同一首；随机与循环的开关状态记在本机，下次打开还保留' },
      { type: 'improve', text: '「图片展览」改名「图展」，页面分「静态图片」与「动态壁纸」两区并各带数量角标；两区各自拉数据，一边失败不会让整页变成错误页' },
      { type: 'improve', text: '动态壁纸上传默认私人（视频比图片更大更敏感，误公开代价高），站长在策展抽屉里显式打开「公开」才会出现在访客的动态壁纸区' },
      { type: 'remove', text: '图书只保留 EPUB 与 PDF：这两种浏览器能直接渲染、可站内阅读；MOBI / AZW3 从上传白名单移除（上传直接拒绝），前端也不再出现这两个格式的入口、筛选项与「暂不支持在线阅读」提示' },
      { type: 'fix', text: '修好站长本人登录后收藏页「内容重复两份」的问题：那个「站长收藏」分区的内容就是站长自己的收藏，站长再看到一遍没有意义；现在站长本人只看到自己那一份（可移除），访客与普通用户仍能看到「站长收藏」分区' },
      { type: 'remove', text: '移除页面跳转的「曲速星海」全屏过场动画：用户反馈转场时间过长（先压到 2 秒仍嫌慢），现在点站内链接直接进入新页面，页面本身的淡入上浮动效保留' },
      { type: 'improve', text: '液态金属珠改成品牌渐变（青→紫→粉，与首页标题同一套）：7 颗珠子各取渐变的一段，头珠偏青、尾珠偏粉，画圈聚成大球时是一颗多色球；之前颜色从主题主色派生，三套主题下看起来「一直是青色」' },
      { type: 'fix', text: '修好首页首屏标题「有些字显示不全」的问题：行盒高度按 line-height 算只有 0.98em，而汉字墨迹加字体的 ascent/descent 后约 1.0em，顶部笔画被 overflow:hidden 切掉约 4px（两行都被裁）；现在把行盒加高到 1.06em 并给足上下内边距，再用等量负外边距还回间距' },
      { type: 'improve', text: '首页首屏文案改回左对齐（之前是 112 模板那种居中封面排版）：标题、细线、副标与按钮统一贴左侧，字号上限从 176px 收到 132px，一行 6 个字放得下、也不会撞到右侧的悬浮时钟' },
      { type: 'fix', text: '修好首页「站点构成」里音乐与影视一直显示 0 的问题：访客口径的条目数应该读站长公开收藏（/api/favorites/public），之前直接读 /api/music 与 /api/movies，被后端的公开过滤挡成空数组' },
      { type: 'improve', text: '首页首屏标题定为「把散落的碎片 / 收进一张星图」两行（「知识」改「碎片」），青→紫→粉的渐变按字切片保留' },
      { type: 'improve', text: '品牌字标 Dora Studio 挪到「此刻」区铁屑卡片左上角，沿用同一套青→紫→粉渐变（逐字切片），铁屑整体下移让出位置' },
      { type: 'improve', text: '书架改成与首页轮播图同宽的全幅书架：横向铺满整个视口，三层、每层 6~10 本，书宽对齐图书页（最大 178px），木纹层板 + 背板暗角 + 接触阴影，仿真度更高' },
      { type: 'improve', text: '书架书少时按「轮流落三层」分摊，并用生成式封面补齐空位（按书 id 做确定性色相偏移，每本封面颜色都不同），不会再出现空着一条光板' },
      { type: 'improve', text: '首页「站点构成」的模块配色换成多彩鲜艳色（红 / 蓝 / 橙 / 紫 / 青 / 绿），不再使用棕色、灰色这类偏暗色系' },
      { type: 'feat', text: '新增「共创」页（导航栏进入）：邀请大家一起参与站点建设，带匿名 / 实名可选的反馈表单（缺陷 / 值得改进 / 想要的新功能 / 其它四类），提交后弹一个正中的温暖感谢弹窗，并给站长的通知铃铛插一条提醒' },
      { type: 'feat', text: '站长端新增「共创反馈」收件箱：按状态（待处理 / 已读 / 已处理）与类别筛选，可写站长备注、改状态、删除；匿名条目绝不显示提交者身份' },
      { type: 'feat', text: '共创页结尾放了一个与首页呼应的 Dora Studio 巨型字标（逐字错峰点亮的 RGB 错位呼吸），中间还嵌了一颗缩小版的「一个宇宙」星体点缀，写着「欢迎加入共创」' },
      { type: 'feat', text: '音乐页点头像（或详情页封面）直达歌词页：左侧黑胶唱片随播放匀速自转、带外圈呼吸光晕，右侧实时滚动歌词；未唱行压暗，唱过的行按离当前行的距离渐隐（越早越淡），当前行最大最亮、走主题渐变文字并带流动光带' },
      { type: 'improve', text: '影视海报卡右上角从纯「+」图标改成带文字的胶囊按钮：站长与已登录用户显示「加入影视库」，访客显示「播放」，一眼看得懂点下去会发生什么' },
      { type: 'improve', text: '新增全站页面加载进度条：点击站内链接后先等 120 毫秒，页面秒开就完全不显示；一旦显示就没有固定时长、慢多久转多久，内容到位立刻收尾淡出' },
      { type: 'fix', text: '修好影视收藏点击后要等 3~4 秒才跳转的问题：之前入库后要把整个影视列表重拉一遍再找刚建的那条，现在直接用创建接口的返回结果跳转，延迟消失' },
      { type: 'fix', text: '修好影视播放的代理兼容：直连失败自动切代理、代理也失败再换下一条线路，并记住直连失败过的域名，国内网络与代理环境都能播' },
      { type: 'improve', text: '首页书架改成两行反向流动的书带：上面一行从左往右、下面一行从右往左，匀速无缝循环；鼠标停在书架区域就暂停，方便看清书名' },
      { type: 'improve', text: '首页书架不再两边抵到视口边缘：收回全幅铺满，改成与正文同宽，两侧用渐隐收口，书是淡出而不是被硬切一刀' },
      { type: 'feat', text: '首页书架上的书可以直接点开阅读：点真实图书就地弹出阅读器（与图书页同一个阅读器，支持 EPUB 章节、PDF 内嵌、字号 / 字体 / 背景 / 单双页设置），书架右上角另有「查看更多 →」进入图书页' },
      { type: 'feat', text: '首页首屏单独加一条「标题带」：大图下方是「把散落的碎片 / 收进一张星图」两行巨字，逐字错峰升起、底下一条手绘感下划线按笔画画出，右上角挂一个实时走动的时钟（原首屏上的「个人知识库」小标、悬浮时钟与印章小组件一并撤掉，首屏只剩大图 + 副标 + 两个按钮）' },
      { type: 'improve', text: '「写在前面」的开场文字改成**逐字跟随滚动由虚到实**：每个字初始模糊、半透明，滚到眼前才变清晰，像从雾里读出来；之前是整行一起模糊揭幕' },
      { type: 'improve', text: '首页「站点构成」的环形图整体加大加粗提速：画布从 620 放到 700、环带描边 4.5 → 6.5、刻度 0.9 → 1.2，模块名 17 → 20px、说明 9 → 11.5px 并加重，旋转一圈从 120 秒压到 42 秒并叠一层呼吸缩放，远看也看得清、不再像慢动作' },
      { type: 'improve', text: '全站字体收口到同一套 UI 字面：导航栏、菜单、登录 / 主题胶囊、按钮、表单控件、表格统一走同一字体与字号（之前导航压根没声明字体，各浏览器各自回退，所以和左侧品牌名对不上）；顺带把几处浏览器会合成假粗体的 600 字重收到真实存在的档位' },
      { type: 'improve', text: '博客列表页横幅站名改成英文「The Blog of Dora」' },
      { type: 'feat', text: '音乐搜索新增「酷我（官方）」这一路音源：完全独立的第三个片库，直链是普通 CDN 地址（不签名、不过期），实测 8 个热门关键词搜索与取流 8/8 可用，是目前可用性最好的一路；音质按无损 FLAC → 320K → 128K 逐档降级，拿到哪档标哪档，不虚标' },
      { type: 'fix', text: '修好音乐「搜出来点进去放不了」的一类情况：网易云官方外链对版权受限曲目会 302 到 HTML 页面，现在搜索时并发探测最靠前的若干条外链，拿不到音频的沉到后面，能播的先出现' },
      { type: 'improve', text: '首页「此刻」的 DoraStudio 铁屑卡片，字形**周围**也铺了一圈环绕铁屑把字围起来（原来只有字形本身加一圈极窄毛边，字是孤零零浮在卡片里）；环绕带按像素定宽，字号 / 容器变化时观感一致，密度由内向外递减，只在外圈范围内铺、不退化成铺满整块' },
      { type: 'improve', text: '移动端触屏适配：修好顶栏控件被 flex 压扁的问题（390px 视口下搜索按钮曾被挤成 20px、主题按钮 27px）；一批按钮的命中区补到 40~44px（轮播箭头、影视与音乐首屏按钮、查看更多、更新日志版本锚点、共创页与首页页脚链接、海报墙行箭头等）；首页轮播那 18 个进度点在手机端收起（横排要 750px 宽、必然溢出），只留「上一张 / 03 / 18 / 下一张」' },
      { type: 'fix', text: '首页「写在前面」文案：「反复听过的歌和看过的片」改为「反复听过的歌与看过的影视」，「一段影像」改为「一部作品」' }
    ]
  },
  {
    version: 'v0.10.0',
    date: '2026-10-11',
    title: '首页封面换成 DoraStudio 字标 + 图谱大幅精简 + 真实书架与摘抄带',
    summary: '首页首屏换成 112 模板的封面式排版（DoraStudio 巨型渐变字标 + 渐变细线），「最近写的」文章列表下架、换成一段站点简介；「此刻」区删掉倒计时与每月文章数，加入品牌铁屑字样、真实书架与摘抄带；图谱页按用户点名单张删除一半图表，只留流向图、占比点阵、矩形树图、体量排行等；新增液态金属珠与曲速星海过场。',
    changes: [
      { type: 'feat', text: '首页首屏换成 112 模板的封面排版：Dora / Studio 两行巨型衬线字标，按字切片拼成一条青→紫→粉的连续渐变（不是逐字各一条），下方一条渐变细线' },
      { type: 'feat', text: '新增液态金属珠指针层：7 颗珠子首尾相连，悬停时跟手，按住持续画圈拖动时会膨胀成一颗明显更大的金属球并黏成一团' },
      { type: 'feat', text: '新增页面跳转过场「曲速星海」：点站内链接跳页时，数百颗星从中心向外拉成光线、铺满一屏后淡出，露出新页面' },
      { type: 'feat', text: '首页「站点构成」换成像素翻牌：一个方块 = 一条公开条目，按模块占比铺满，指针扫过由近及远依次翻牌' },
      { type: 'feat', text: '「此刻」区加入品牌铁屑：网格铁屑只在 DoraStudio 字形上密集出现，指针可拖动磁极，整体是一团铁屑拼出的品牌字样' },
      { type: 'feat', text: '「此刻」区书架重做成真实书架：三层隔板 + 落影 + 轻微 3D 斜视角，书是正面立着的、直接显示封面渲染图（缺封面用生成式封面补），悬停像从架上抽出' },
      { type: 'feat', text: '新增「摘抄带」：把原来的一句话与每月文章数合并拓宽成一整条，专门放较长的美文摘抄与哲理性段落，悬停暂停、点一下换一段' },
      { type: 'feat', text: '时间轴加上模糊揭幕动效：卡片进入视口时从虚到实、由下归位，播完即锁死为清晰状态（不会停在半模糊）' },
      { type: 'improve', text: '「最近写的」文章列表从首页移除，标题与手绘横线保留，下面换成一段介绍整个站点内容的开场白（逐行模糊揭幕）' },
      { type: 'improve', text: '首页关于区的印章中心字由「朵」改成站名 Dora，并按字数自动收敛字号，避免溢出圆环' },
      { type: 'remove', text: '图谱页删除：和弦图、多维环形对比、同心环段、轨道星座、流带时间轴、山脊图、分类/语言×标签/分类的构成图与交叉热度图、每月发文/每月新增收藏、内容构成雷达、内容健康度仪表、语言×star 分布气泡图' },
      { type: 'remove', text: '首页「此刻」区删除「距离下一个整点」倒计时方框，以及「拨动时间的天空」与「每月文章数」折线' }
    ]
  },
  {
    version: 'v0.9.0',
    date: '2026-10-11',
    title: '首页标题逐字动效 + 图谱新增 8 张高级统计图 + 桑基图真实流光',
    summary: '首页大标题改成「逐字升起 + 第二行描边空心字」（借鉴站长给的《余白》模板），背景流场从两色素流升级成三色墨迹并可切换配色；图谱页在原有 8 张统计图之外**新增 8 张**（和弦图 / 多维环形 / 同心环段 / 占比点阵 / 矩形树图 / 轨道星座 / 流带时间轴 / 山脊图），全部带入场动画、流动光点与悬停交互；流向图（桑基）重写为真实流动光点 + 跟随鼠标 tooltip。',
    changes: [
      { type: 'feat', text: '首页大标题逐字动效：每个字从下方带旋转升起，第二行是描边空心字，悬停单字会上浮并换成暖色；prefers-reduced-motion 下直接给终态' },
      { type: 'feat', text: '首页背景流场升级为「三色墨迹」：粒子分 3 个色相组交织，右下角可点击切换 3 套配色（靛紫霞光 / 水墨留白 / 琥珀日落），颜色跟随三套主题自动变化' },
      { type: 'feat', text: '图谱页新增「和弦图」：左右各一圈弧，中间缎带宽度 ∝ 数量，缎带从起点「长」到终点，带上有真实流动光点' },
      { type: 'feat', text: '图谱页新增「多维环形对比」：每个分类一根从圆心向外辐射的堆叠柱，从圆心长出、逐段淡入，悬停单段沿径向外推' },
      { type: 'feat', text: '图谱页新增「同心环段」：第 i 圈 = 第 i 个分类，每圈自己是一个完整的 100%，弧段错峰扫出、环上有流动光点' },
      { type: 'feat', text: '图谱页新增「占比点阵」（华夫格）：每个方块 = 一份，按占比涂色，对角线错峰弹出；悬停方块时同段一起提亮、他段压暗' },
      { type: 'feat', text: '图谱页新增「矩形树图」：squarified 算法让矩形尽量接近正方形，面积 ∝ 数量，逐块从中心放大出现，叠一层缓慢扫过的高光' },
      { type: 'feat', text: '图谱页新增「轨道星座」：每个分类是一颗恒星，组内条目是绕它差速公转的行星（内圈快外圈慢），入场时从恒星飞出，连线上有流动光点' },
      { type: 'feat', text: '图谱页新增「流带时间轴」：多条时间序列画成互相错开的渐变光带，带上有沿曲线流动的光点，悬停某一列可对比当月各序列数值' },
      { type: 'feat', text: '图谱页新增「山脊图」（Joyplot）：每条脊是一个分类的月度形状，层峦叠嶂互相叠压，悬停抬升提亮' },
      { type: 'improve', text: '流向图（桑基）重写：每条带子按宽度挂真实流动光点（沿中轴滚动、两端淡中间亮），单个 rAF 驱动、离屏自动暂停' },
      { type: 'improve', text: '流向图悬停交互重做：悬停节点只高亮它的出入边、悬停带子只亮这一条，其余压暗；提示从原生 <title> 换成跟随鼠标的浮层' },
      { type: 'fix', text: '修掉流向图一个致命 bug：列坐标只写在列上、画带子时却取节点坐标，导致路径全是 NaN —— 桑基图的带子此前其实一条都画不出来' },
      { type: 'fix', text: '图谱接口超时从 20 秒放宽到 45 秒：图谱要一次读完全部内容再算星区，慢的时候 20 秒会被误判成「请求超时」而显示错误页' },
      { type: 'improve', text: '「同心环段」的圈标签从贴在环上改成图下方一行图例 —— 圈一窄，贴在环上的标签会重叠成一团' }
    ]
  },
  {
    version: 'v0.8.0',
    date: '2026-10-11',
    title: '首页编辑器式改版 + 全站指针特效层 + 图表动效升级',
    summary: '首页按站长给的新模板重做（报头 / 最近写的 / 跑马灯 / 此刻 Bento 小组件 / 关于这个站点 / 巨型水印页脚），新增生成式封面与噪声流场画布；全站加一层指针特效（点击爆散 / 拖尾 / 自定义光标 / 磁吸 / 倾斜高光）与页面切换过渡；图谱统计图统一升级入场动画与悬停质感。',
    changes: [
      { type: 'feat', text: '首页改版为编辑器式版面：Hero 轮播 + 「最近写的」（分类标签页 / 特写文章 / 归档列表 / 悬浮预览）+ 跑马灯 + 「此刻」+ 「站点构成」+ 「关于这个站点」+ 巨型水印页脚 DoraStudio' },
      { type: 'feat', text: '新增「此刻」Bento 小组件区：此刻天空（可拖时间轴）、倒计时翻页数字、写作热力日历、迷你折线、一句话轮播、书架（鼠标靠近书脊会倒）' },
      { type: 'feat', text: '新增生成式封面 lib/genCover.js：零依赖、无网络请求，用 seed 稳定生成 waves / rings / arcs / dots 四种图案，文章与图书缺封面时自动补一张不重样的' },
      { type: 'feat', text: '新增噪声流场画布组件 HomeFlow：Perlin 噪声 + 粒子拖尾 + 鼠标涡旋，进入视口才跑、离屏暂停，prefers-reduced-motion 下退化为静态图' },
      { type: 'feat', text: '新增全站指针特效层 ClickFx：点击爆散、指针拖尾、自定义光标（链接空心环 / data-cursor 实心大圆带文字 / 按下缩放）、磁吸按钮、倾斜 + 高光卡片；只在支持悬停的精细指针设备启用，暴露 window.__doraFx 供其它组件调用' },
      { type: 'feat', text: 'Hero 轮播加悬浮小组件：实时时钟（指针每秒转动）+ 印章' },
      { type: 'improve', text: '页面切换加过渡：路由变化时主区域整块重挂并淡入上浮，顶栏品牌名滑入' },
      { type: 'improve', text: '图谱统计图（除星空图外）统一升级：图形元素错峰生长 / 折线从 0 画出、悬停放大提亮、发丝线网格、等宽数字、卡片渐变底，并补齐 prefers-reduced-motion 退化' },
      { type: 'improve', text: '全站排版细化：字号层级、行高、间距节奏、滚动条样式与焦点环统一' },
      { type: 'fix', text: '修复切换页面时视图停在上一页滚动位置（看起来像「滑到最底下再显示」）：路由变化时把滚动位置归零' }
    ]
  },
  {
    version: 'v0.7.0',
    date: '2026-10-11',
    title: '图书放开大小 + 阅读器增强 + 图谱侧栏对齐 + 按钮一致性',
    summary: '图书上传不再限制单本大小（改走 R2 分片），阅读器补齐翻页 / 背景色 / 字号 / 字体 / 双页 / 进度条；图谱右侧栏与画布严格等高且不出滚动条；修掉「图标 + 文字」按钮被挤成两行的显示问题。',
    changes: [
      { type: 'feat', text: '图书上传去掉单本大小上限：小文件（≤80MB）直传，大文件自动切 8MB 分片走 R2 multipart（create → uploadPart → complete / abort），后端上限提到 5GB' },
      { type: 'feat', text: '阅读器增强：双指 / 滚轮 / 方向键上下滑动翻页、阅读背景色（纸白 / 米黄 / 淡青 / 夜间）、字号档位、字体选择、单页 / 双页切换、可拖动跳章的阅读进度条，设置记在本地' },
      { type: 'feat', text: '自托管「霞鹜文楷」字体（97 个 woff2 分片 + OFL 许可，约 4.7MB），作为阅读器默认字体，不再依赖系统字库' },
      { type: 'feat', text: '时间轴新增「图书」类型：按上传时间并入时间轴，卡片显示书名 / 作者 / 格式 / 封面，点击进入 /books' },
      { type: 'improve', text: '图谱右侧栏改版：搜索框 + 分类 / 标签（博客）与语言 / 应用分类（开源）改为等分面板，与左侧画布严格等高（实测 620px vs 620px），内容自动缩字号全部平铺，不再出现内部滚动条' },
      { type: 'improve', text: '导航「更新版」改名为「更新」' },
      { type: 'fix', text: '修复「图标 + 文字」按钮被挤成两行：图标是 display:block 而按钮是 inline-block，图标掉到第二行导致按钮一高一矮（影视详情「立即播放 / 收藏此片」、图书上传「选择文件」等）' },
      { type: 'fix', text: '修复搜索框里的按钮高过搜索框（收敛到 28px），章节目录条目改为铺满整行' }
    ]
  },
  {
    version: 'v0.6.0',
    date: '2026-10-11',
    title: '图书重新上线：限制体积 + 自动封面 + 在线阅读',
    summary: '上一轮因单本过大整体下线，这轮换一套做法重新上线：单本限 100MB、上传时后端自动提取封面、点击封面就地在线阅读。',
    changes: [
      { type: 'feat', text: '新增电子书书架（一级导航「图书」/books）：2:3 封面墙 + 搜索 + 格式筛选，封面由后端上传时自动提取，前端不下载正文' },
      { type: 'feat', text: '新增 4 种格式支持：EPUB / PDF / MOBI / AZW3，按文件魔数嗅探类型，不信任扩展名' },
      { type: 'feat', text: '新增站内阅读器：PDF 用浏览器原生查看器（后端 Range 透传，不整本进内存），EPUB 用零依赖解析器在浏览器里解压并分章渲染，带章节目录' },
      { type: 'feat', text: '新增「下载」按钮：点击图书默认在线阅读，想存本地的人自己点下载，不强制下载' },
      { type: 'feat', text: '新增后端封面提取（backend/src/lib/bookCover.js）：EPUB 解 zip 中央目录 + OPF、PDF 扫 DCTDecode 图像流、MOBI/AZW3 解 PalmDB + EXTH，只按需 range 读几段字节（80MB 的 EPUB 实测堆增量约 0.3MB）' },
      { type: 'improve', text: '单本上限从 1GB 收到 100MB：正是上一轮「24 本 2.4GB、最大单本 772MB」导致下线的根因' },
      { type: 'improve', text: '站长管理：拖拽上传带进度、改书名 / 作者 / 简介、公开 / 私人切换、删除；访客与普通登录用户只看到公开书' }
    ]
  },
  {
    version: 'v0.5.8',
    date: '2026-10-11',
    title: '移除图书功能',
    summary: '用户实测后发现电子书文件太大（24 本约 2.4GB，最大单本 772MB），占 R2 存储与流量、阅读体验性价比低，整体下线。',
    changes: [
      { type: 'remove', text: '移除一级导航「图书」与前端 /books 书架页、站内阅读器' },
      { type: 'remove', text: '移除后端 /api/books* 全部接口、books 数据表，以及 R2 里 books/ 前缀下的 24 个电子书对象' },
      { type: 'remove', text: '移除前端 lib/epub.js 与 lib/zipReader.js（仅图书阅读器使用）' },
      { type: 'improve', text: '首页主模块由 6 个回到 5 个，径向图同步减一环' },
      { type: 'fix', text: '同步清理 supabase_migrations 里的 20261011000020 记录，避免删掉迁移文件后 db push 报状态不一致' }
    ]
  },
  {
    version: 'v0.5.7',
    date: '2026-10-11',
    title: '首页 Atlas 改版 + 全站字体修复',
    summary: '未登录首页按「编辑式图谱 / Atlas」信息图版式重做；同时修掉全站「中文 + 等宽字体」发虚的根因。',
    changes: [
      { type: 'feat', text: '新增首页 Atlas 版式（frontend/src/styles/home-landing.css）：报头 + 三栏主体（模块索引 / 手写 SVG 同心环径向图 / 能力清单）+ 底部两块图表面板' },
      { type: 'improve', text: '首页内容与现状对齐：删掉 2026-10-09 已下线的「学习视频库」，主模块改为真实一级导航，主题文案改为「纯净 / 素雅 / 天青」' },
      { type: 'improve', text: '首页数字改为从公开只读接口实时读取（Promise.allSettled，失败不白屏）' },
      { type: 'fix', text: '修复全站字体发虚：等宽字体栈没有汉字，中文回退到 Windows 的 NSimSun 点阵宋体；给 --font-mono / --sm-mono / --gc-mono 三处补中文字形兜底，中文走无衬线、拉丁数字仍走等宽' },
      { type: 'fix', text: '图谱页正文默认字体从等宽改为 UI 字体，标题改用展示衬线体，副标题与 chip 字号上调（11.5px → 13px）' },
      { type: 'improve', text: '统一搜索框 placeholder 文案（「搜文章标题…」→「搜索文章标题…」）' },
      { type: 'fix', text: '修复 /api/me 阻塞首屏：改为后台补拉；并给 API 域名加 preconnect / dns-prefetch' }
    ]
  },
  {
    version: 'v0.5.6',
    date: '2026-10-11',
    title: '登录按钮对齐 + 时间轴博客修复 + 切页提速',
    summary: '修两个用户反馈的显示问题，并解决「同一页面来回切要反复等接口」的卡顿。',
    changes: [
      { type: 'fix', text: '修复顶栏登录按钮与主题按钮尺寸不一致：通用圆形按钮规则把带 title 的登录按钮一起命中，实际变成 38×38 圆点；加 :not(.login-link) 排除后两按钮均为 74×36、顶边对齐' },
      { type: 'fix', text: '修复时间轴「博客」标签空白：GitHub 一次同步把上千条收藏写成同一秒，按时间倒序排在前面，把博客挤出首屏；改为按标签单独请求 + 按标签分别缓存' },
      { type: 'feat', text: '新增 /api/timeline?type=post|github|gallery|music|movie 单类型查询，只查对应那张表，比全部合并快很多' },
      { type: 'feat', text: '前端 API 层新增 GET 读缓存（内存 60s TTL、LRU 上限 120 条、只缓存成功结果）+ 并发去重 + 写后按路径前缀失效，标签来回切换基本瞬时' }
    ]
  },
  {
    version: 'v0.5.5',
    date: '2026-10-11',
    title: '图书库 + 图展 / 导航 / 主题 / 图谱收尾',
    summary: '第一版图书库上线（后来因体积过大被下线），同时收尾导航命名、收藏页、时间轴、播放器进度条与图谱布局。',
    changes: [
      { type: 'feat', text: '新增图书库（一级导航「图书」/books），仿 Koodo Reader 布局：左侧栏（全部 / 收藏 / 阅读历史 / 我的书架）+ 顶栏 + 2:3 封面网格' },
      { type: 'feat', text: '新增 R2 分片上传（create → uploadPart → complete / abort）与 Range 透传读取，PDF 按需拉字节不整本进 Worker 内存' },
      { type: 'improve', text: '「图片展」更名为「图展」' },
      { type: 'improve', text: '收藏页改为对访客开放：未登录渲染友好空态，401 / 403 都按「请先登录」处理' },
      { type: 'improve', text: '时间轴去掉「全部」标签，默认落在博客；音乐与影视改为收听 / 观看历史（按播放进度聚合，只保留公开资源）' },
      { type: 'improve', text: '影视播放进度条加粗到 6px，并用高亮色标出已播放部分' },
      { type: 'improve', text: '图谱搜索框从顶部 HUD 移到右侧栏最上方，正对下方分类 / 标签 / 列表' },
      { type: 'fix', text: '修复图展灯箱「点图先滚到底再显示」：灯箱改用 createPortal 挂到 document.body，祖先的 transform 会让 position: fixed 相对整页定位' },
      { type: 'fix', text: '修复图书 CORS：GET /api/books/:id 补 Access-Control-Allow-Origin 并暴露 Content-Range，否则前端取 EPUB 字节会被浏览器拦掉' }
    ]
  },
  {
    version: 'v0.5.4',
    date: '2026-10-11',
    title: '第三套主题 + 登录注册页 + 图片上传 + 碎念附件 + 收藏改版',
    summary: '一轮七件事：主题加「天青」、顶栏设置入口、登录 / 注册页重做、图片展策展抽屉直接上传、碎念支持文档附件、收藏页改版、图谱文字修虚。',
    changes: [
      { type: 'feat', text: '新增第三套主题「天青」（青绿主色 #0f9b8e + 冷白底），三套主题显示名去掉「主题」二字，统一为 纯净 / 素雅 / 天青' },
      { type: 'feat', text: '新增顶栏设置入口：主题按钮右侧常驻齿轮，已登录进 /settings、访客进 /login' },
      { type: 'feat', text: '登录页重做为两个标签页：站长登录（邮箱 + 密码）与新用户注册（邮箱 + 密码 + 确认密码），注册者一律是普通用户' },
      { type: 'feat', text: '图片展策展抽屉新增「上传新图片」：选本地图片传 R2 后自动创建展览条目（默认公开），多选逐张上传并显示进度' },
      { type: 'feat', text: '碎念新增文件附件（PDF / Word / Excel / PPT / 文本），单文件上限 20MB，附件公开状态跟随碎念自动收放' },
      { type: 'feat', text: '新增 /api/files 文档接口与 files / moment_files 两张表，避免 PDF 混进图片展破坏缩略图' },
      { type: 'improve', text: '收藏页重写为「音乐 + 影视 + 其它」分组，音乐 1:1、影视 2:3 封面网格，并在详情页接入收藏按钮' },
      { type: 'fix', text: '修复图谱枢纽标签「发虚」：从描边光晕改成实底药丸 + 左侧色条，并加纵向避让避免互相压住' },
      { type: 'fix', text: '修复碎念编辑时清空已有配图的问题' }
    ]
  },
  {
    version: 'v0.5.3',
    date: '2026-10-11',
    title: '图谱拆分 + GitHub 收藏公开 + teldrive 清理',
    summary: 'GitHub 收藏页空白查出根因是数据全为私有；同时把「更多」下拉彻底换成「图谱」一级入口，并放出两个公开星图。',
    changes: [
      { type: 'fix', text: '修复 GitHub 收藏页「什么都不显示」：1342 条 github 资源的 is_public 全是 false，访客视角恒返回空；同步逻辑改为默认公开，并批量修正线上数据' },
      { type: 'remove', text: '按用户要求删除已取消收藏的 tgdrive/teldrive 仓库记录，时间轴为动态聚合无需另删' },
      { type: 'feat', text: '新增两个公开图谱接口：GET /api/graph/blog（分类 / 标签枢纽 + 公开文章）与 GET /api/graph/repos（编程语言 / AI 应用分类枢纽 + 公开收藏）' },
      { type: 'feat', text: '新增 Canvas 星图组件 StarMap 与图谱页 GraphHub，顶栏「图谱」指向 /graph/blog，两种图谱在页内用标签切换' },
      { type: 'improve', text: '星图布局定为「星区」：每个分类 / 语言占一个扇形角度，同区同色；连线随机但用节点下标做种子，刷新画面不抖' },
      { type: 'improve', text: '星图背景改为跟随站点主题色（不再固定暗色），并删掉会连顶栏一起改暗的 page-dark 覆盖规则' },
      { type: 'improve', text: '性能优化：坐标一次算完，连线与星点按颜色分桶，1341 点 + 2500 线仍保持 60fps' }
    ]
  },
  {
    version: 'v0.5.2',
    date: '2026-10-11',
    title: '「此刻」改版为「碎念」+ 去掉「更多」下拉',
    summary: '把「此刻」做成朋友圈式的碎念时间流，并先修掉一个必须先修的严重问题：线上根本没有对应的数据表。',
    changes: [
      { type: 'fix', text: '修复「此刻」页从来没能用过：迁移文件只写了没执行，线上数据库没有 now_entries 表，/api/now 一直 404' },
      { type: 'feat', text: '新增朋友圈式碎念时间流（/moments）：头像 + 昵称 + 相对时间 + 正文 + 九宫格配图，点图进灯箱' },
      { type: 'feat', text: '新增发布框：文本框 + 图片选择（上传新图或从已有素材挑）+ 公开开关（默认勾选），配图上限 9 张' },
      { type: 'feat', text: '新增 moments / moment_assets 两张表，并用复合外键在数据库层强制「配图与碎念同 owner」' },
      { type: 'remove', text: '移除顶栏「更多」下拉（当时只剩「碎念」一项），「碎念」升为一级导航，管理员专属的「源状态」移入头像菜单' },
      { type: 'fix', text: '修复昵称与头像恒为空：资料字段在 profile 上而不是 useAuth().user 上，并新增护栏测试防止复发' },
      { type: 'improve', text: '响应白名单收紧：绝不回传 user_id，配图不含 object_key / sha256 / original_name' }
    ]
  },
  {
    version: 'v0.5.1',
    date: '2026-10-11',
    title: 'GitHub 收藏全量同步 + AI 中文解读加严',
    summary: '结论先说：功能早就写好了，坏的是「数据没同步完」+「解读质量没下限」。这轮只修数据与解读质量，没有重写界面。',
    changes: [
      { type: 'fix', text: '修复 GitHub 同步一直失败：线上 Worker 没配 GITHUB_TOKEN，匿名接口每小时每 IP 只有 60 次，而一次完整同步要拉 14 页必然中途 403；配好令牌后完整同步 1342 个仓库（此前库里只有 638 个）' },
      { type: 'improve', text: 'AI 解读加严：提示词明确要求全文简体中文，且 summary 不少于 50 个字；解析层加硬校验，汉字数不足直接判失败不写库' },
      { type: 'improve', text: '新增 AI_VERSION 版本号，低于当前版本的行自动重新解读，以后改提示词只要版本号 +1 即可全量重做' },
      { type: 'improve', text: 'AI 解读失败时最多重试 3 次并逐次提高 temperature，比整条判失败更省额度' },
      { type: 'fix', text: '修复含控制字符 / 零宽字符的 README 导致 Workers AI 请求体报 8006：新增文本清洗（保留换行与制表符）' },
      { type: 'fix', text: '删掉「英文字符占比过半就算不是中文」的误判规则，避免 API / GraphQL 术语密集的仓库被永久跳过' }
    ]
  },
  {
    version: 'v0.5.0',
    date: '2026-10-11',
    title: '导航精简 + 图展灯箱定位修复 + 展览数据重建',
    summary: '导航收一遍、修掉灯箱「点图先滚到底」与翻页延迟，并重建整个图片展数据。',
    changes: [
      { type: 'improve', text: '「收藏」从下拉提升为一级导航；「分类」「标签」从导航移除（博客页已自带，路由本身保留）' },
      { type: 'fix', text: '修复图展灯箱打开时先滚到页面最低：页面入场动画残留的 transform 让 position: fixed 改为相对祖先定位，改用 createPortal 挂到 body' },
      { type: 'fix', text: '修复打开灯箱时聚焦元素触发 scrollIntoView 把页面滚走，改为 focus({ preventScroll: true })' },
      { type: 'fix', text: '修复关闭灯箱时的缓慢滚动动画（全局 scroll-behavior: smooth 所致），关闭时瞬时归位' },
      { type: 'feat', text: '灯箱进入后预加载相邻 ±2 张，翻页不再等图' },
      { type: 'improve', text: '上一张 / 下一张按钮加大到 42px（触屏 46px），半透明深底 + 细描边 + 阴影，补按下与键盘焦点反馈' },
      { type: 'improve', text: '重建展览数据：本机 50 张 / 279MB 全部预处理为 WebP、最长边 2560px（9.7MB），去重后 48 张全部上传并加入公开展览' }
    ]
  },
  {
    version: 'v0.4.6',
    date: '2026-10-10',
    title: '「此刻」页 + 设置与安全中心',
    summary: '新增站长公开状态页与设置页；设置页能改安全字段，但绝不允许自提权。',
    changes: [
      { type: 'feat', text: '新增 /now「此刻」公开状态页：站长显式发布在造 / 在学 / 在读 / 在听 / 在看 / 在想，不是行为追踪；is_public 默认 false（私人）' },
      { type: 'feat', text: '新增 /settings 设置与安全中心：账号（邮箱 / 角色 / 套餐 / ID 只读）、外观、安全（官方重置邮件 + 退出二次确认）、数据备份入口' },
      { type: 'feat', text: '新增 PATCH /api/me：只开放 display_name / avatar_path / username，role / plan / is_disabled 等特权字段出现即 422（不是静默忽略）' },
      { type: 'fix', text: '自审修掉 3 个真实缺陷：设置页主题按钮误从 useAuth 解构导致整页崩溃、空 username 提交平白 422、此刻页编辑表单残留上一个条目的值' },
      { type: 'improve', text: '新增护栏测试：静态解析 Provider 暴露的键，扫描全部 .jsx 的解构，越界即失败' }
    ]
  },
  {
    version: 'v0.4.5',
    date: '2026-10-10',
    title: '图片展览 + 公开时间轴',
    summary: '新增图片展与公开时间轴两个浏览入口。',
    changes: [
      { type: 'feat', text: '新增图片展览 /gallery：策展式图片墙 + 灯箱浏览 + 键盘方向键翻页' },
      { type: 'feat', text: '新增公开时间轴 /timeline：把博客 / GitHub / 图片 / 音乐 / 影视按时间聚合成一条流' },
      { type: 'improve', text: '时间轴后端按时间动态聚合，删掉某条资源后时间轴自动不再出现，无需另删' }
    ]
  },
  {
    version: 'v0.4.4',
    date: '2026-10-10',
    title: '影视 / 音乐播放可靠性修复',
    summary: '针对「搜到了但播不了」做一轮端到端修复。',
    changes: [
      { type: 'fix', text: '修复影视播放失败链路：直连失败自动切代理、代理也失败再换下一条线路，并记住直连失败过的域名' },
      { type: 'fix', text: '修复音乐音源取不到直链的问题，播放失败时自动重解析新直链续播' },
      { type: 'improve', text: '播放失败时的提示文案改为可读的中文原因，不再是裸错误码' }
    ]
  },
  {
    version: 'v0.4.3',
    date: '2026-10-10',
    title: '修复访客越权（公开 / 登录 / 管理员三层边界）',
    summary: '访客只读模式下，把「公开子集」的边界在查询层显式收口。',
    changes: [
      { type: 'fix', text: '修复访客越权：Worker 用 service_role 直连 PostgREST，RLS 不替它过滤，必须在查询层显式叠加 is_public=eq.true' },
      { type: 'improve', text: '资源类（视频 / GitHub / 音乐 / 影视）访客只返回 is_public=true，单条非公开记录返回 404' },
      { type: 'improve', text: '博客访客只返回 published + is_public；收藏夹对访客关闭（页面与接口都要求登录）' },
      { type: 'improve', text: 'AI 解读接口 POST /api/github/analyze 限制为仅管理员可用（消耗 Workers AI 额度）' }
    ]
  },
  {
    version: 'v0.4.2',
    date: '2026-10-10',
    title: '影视 / 音乐源健康中心',
    summary: '给多源聚合加一个可观测面板，并让搜索自动避开失效线路。',
    changes: [
      { type: 'feat', text: '新增源健康中心 /source-health（管理员）：逐源测延迟与可用性，一眼看出哪条线路坏了' },
      { type: 'improve', text: '搜索自动避开失效线路，并对单源设配额避免某一源刷屏' },
      { type: 'improve', text: '影视采集源复测：恢复 360zy（与 360zyzz 不同域名的独立片库，实测 5/5 可播），不采用命中率不足的 ruyi' }
    ]
  },
  {
    version: 'v0.4.1',
    date: '2026-10-10',
    title: '图片素材系统（Cloudflare R2）',
    summary: '把图片素材从 Supabase 存储迁到 R2，并立起「校验 → 落 R2 → 入库 → 回填 URL」的范本。',
    changes: [
      { type: 'feat', text: '新增图片素材系统：上传落 Cloudflare R2，数据库只存 object_key 与元信息' },
      { type: 'feat', text: '新增 assets 接口（上传 / 列表 / 公开读 / 删除），上传失败自动补偿删除 R2 对象，不留孤儿' },
      { type: 'improve', text: '图片读取带 Cache-Control: public, max-age=31536000, immutable，二次浏览基本零等待' }
    ]
  },
  {
    version: 'v0.4.0',
    date: '2026-10-10',
    title: '安全与质量底座',
    summary: '从旧工作区恢复并重做的一轮：先把安全与质量的底座补齐，再谈新功能。',
    changes: [
      { type: 'improve', text: '统一写操作铁律：任何写入（更新 / 删除 / 进度）必须带 user_id=eq.${user.id}，管理员只有 ?all=true 的读权限' },
      { type: 'improve', text: '统一错误响应与日志，避免把内部细节暴露给前端' },
      { type: 'feat', text: '新增凭据泄漏扫描脚本（scripts/check-secrets.mjs），支持扫描历史提交' },
      { type: 'improve', text: '离线单测补齐到 80+ 项，覆盖权限、过滤、类型嗅探等易错点' }
    ]
  },
  {
    version: 'v0.3.10',
    date: '2026-10-09',
    title: '移除视频页',
    summary: '用户表示后续没有用处，入口整体下线（数据与接口保留）。',
    changes: [
      { type: 'remove', text: '移除顶栏「视频」入口、首页「学习视频」磁贴与 /videos 路由（旧链接重定向到首页）' },
      { type: 'improve', text: '保留 /api/videos 接口与数据库数据，Videos.jsx 也未删，日后需要可直接恢复入口' }
    ]
  },
  {
    version: 'v0.3.9',
    date: '2026-10-09',
    title: '图谱改为「知识库控制台」',
    summary: '把图谱从展示型星图改成站长用的控制台。',
    changes: [
      { type: 'feat', text: '新增图谱控制台 /graph：聚合 AI 解读进度等私有数据，供站长查看' },
      { type: 'improve', text: '图谱页改用深色画布（后来按用户要求改为跟随站点主题色）' }
    ]
  },
  {
    version: 'v0.3.8',
    date: '2026-10-09',
    title: 'GitHub 收藏 AI 中文解读 + 主题改为白天 / 素雅',
    summary: '用 Cloudflare Workers AI 给每个仓库写中文解读，并把主题从「浅色 / 暗色」换成「白天 / 素雅」。',
    changes: [
      { type: 'feat', text: '新增 GitHub 收藏 AI 中文解读：每个仓库一段中文说明，写在卡片上' },
      { type: 'improve', text: 'GitHub 页改为 GithubStarsManager 风格：左栏应用分类 + 编程语言方框，右侧卡片列表' },
      { type: 'remove', text: '移除暗色（夜间）主题，改为白天 / 素雅两套；旧的 dark 记录自动当作白天' },
      { type: 'improve', text: '素雅配色参考 GithubStarsManager（MIT）' }
    ]
  },
  {
    version: 'v0.3.7',
    date: '2026-10-09',
    title: 'GitHub 页改为同步 GitHub Star',
    summary: '不再手动添加仓库，改为直接同步自己在 GitHub 上的 Star。',
    changes: [
      { type: 'feat', text: '新增 GitHub Star 定时同步（Worker 每日任务），站长可点「立即同步」' },
      { type: 'improve', text: '页面改为紧凑列表 + 语言 / 话题筛选 + 搜索 + 排序，不再用卡片画廊' },
      { type: 'remove', text: '移除「粘贴链接手动添加」、卡片画廊 / 时间流视图、单个刷新与删除' },
      { type: 'improve', text: '在 GitHub 上取消收藏后 Dora 同步删除（注意：手动添加过的记录也会被清掉）' }
    ]
  },
  {
    version: 'v0.3.6',
    date: '2026-10-09',
    title: '博客顶部横幅 + 阅读页高清头图 + 去掉汉堡菜单',
    summary: '博客首页顶部换成高清横幅，阅读页配高清头图，并去掉窄屏的三横线抽屉。',
    changes: [
      { type: 'feat', text: '博客首页顶部换成高清横幅（大号圆角搜索框），搜索与「分类 / 标签 / 归档 / 写文章」移入横幅' },
      { type: 'feat', text: '博客阅读页配高清头图' },
      { type: 'remove', text: '去掉窄屏顶栏的三横线 / 叉号抽屉菜单，窄屏改为一级导航单行横向滑动' }
    ]
  },
  {
    version: 'v0.3.5',
    date: '2026-10-09',
    title: '博客换成 cosolar 风格（首页 / 阅读页 / 归档三连）',
    summary: '按 halo-theme-cosolar 风格重做博客三处页面。',
    changes: [
      { type: 'feat', text: '博客首页换成 cosolar 风格：精选轮播 + 卡片列表 + 侧边栏' },
      { type: 'feat', text: '博客阅读页 cosolar 风格 + 统一默认封面' },
      { type: 'feat', text: '新增博客归档 / 分类 / 标签页，并补齐移动端适配' },
      { type: 'remove', text: '移除博客列表的「画廊 / 时间流」视图切换（新首页为固定布局）' }
    ]
  },
  {
    version: 'v0.3.4',
    date: '2026-10-09',
    title: '音乐库 UI 升级（Apple Music 风格）',
    summary: '音乐模块三页统一到 Apple Music 观感。',
    changes: [
      { type: 'improve', text: '音乐库改为 Apple Music 风格：专辑封面网格 + 曲目列表 + 常驻底部迷你播放器' },
      { type: 'improve', text: '补齐黑胶播放器与同步歌词页的样式' }
    ]
  },
  {
    version: 'v0.3.3',
    date: '2026-10-09',
    title: '影视库 UI 升级（方案 C）',
    summary: '影视模块整体换一套视觉方案。',
    changes: [
      { type: 'improve', text: '影视库改为海报墙布局，补齐详情页与播放页样式' },
      { type: 'improve', text: '全站页面头与空状态统一（PageHeader v2 + EmptyState）' }
    ]
  },
  {
    version: 'v0.3.2',
    date: '2026-10-09',
    title: '访客只读模式',
    summary: '网站主要给别人看，暂时不需要访客登录，改为访客可只读浏览。',
    changes: [
      { type: 'feat', text: '新增访客只读模式（PUBLIC_MODE）：未登录可以浏览 NewsNow、GitHub、博客、音乐、影视、搜索、分类、标签、图谱' },
      { type: 'improve', text: '访客看到的是站长内容的「公开子集」，不是全部数据' },
      { type: 'improve', text: '访客可以直接播放影视与音乐，不入库、不记进度；但不能新增 / 编辑 / 删除任何内容' },
      { type: 'improve', text: '首页按钮由「免费开始使用」改为「开始浏览」' }
    ]
  },
  {
    version: 'v0.3.1',
    date: '2026-10-09',
    title: '移除 RSS 模块',
    summary: '用户决定不再需要 RSS（原计划从 Folo 导入订阅，后放弃），整体删除且不保留数据。',
    changes: [
      { type: 'remove', text: '移除 RSS 前端页面（订阅源、文章列表）、/rss 路由与导航入口' },
      { type: 'remove', text: '移除后端 /api/rss/* 全部接口与每小时抓取的定时任务' },
      { type: 'remove', text: '移除 rss_feeds / rss_articles 两张表、rss_new 通知类型与 rss_article 资源类型' }
    ]
  },
  {
    version: 'v0.3.0',
    date: '2026-10-09',
    title: 'NewsNow 热榜接入',
    summary: '新增 NewsNow 热榜入口。',
    changes: [
      { type: 'feat', text: '新增 NewsNow 热榜接入与 /news 页面，汇总各平台实时热榜' }
    ]
  },
  {
    version: 'v0.2.0',
    date: '2026-10-07',
    title: '体验重构：UI 质量提升 + 影视源修复',
    summary: '以 Awwwards / Webby / FWA 为基准连续做了三轮 UI 质量提升，并修好影视源。',
    changes: [
      { type: 'improve', text: 'UI 质量提升第一轮：统一间距 / 字号 / 圆角阶梯，统一页面头与空状态' },
      { type: 'improve', text: 'UI 质量提升第二轮：音乐模块三页 + 全站页面头 / 空状态统一' },
      { type: 'improve', text: 'UI 质量提升第三轮：影视详情页核对 + 移动端复核' },
      { type: 'fix', text: '修复影视采集源失效问题，并逐源实测可用性' },
      { type: 'feat', text: '新增设计系统变量（--sp-* / --fs-* / --radius-* / --dur-* / --ease-*），新代码只准用变量' }
    ]
  },
  {
    version: 'v0.1.0',
    date: '2026-10-06',
    title: '接力重构：Phase0–6 底座 + 音乐 / 影视多源聚合',
    summary: '第一版可用形态：把环境底座到各模块全部打通并上线，音乐 / 影视改为多源聚合。',
    changes: [
      { type: 'feat', text: '完成 Phase0–6 底座：JWT 鉴权、分类 / 标签 / 主题 / 双视图、视频 / GitHub / 博客、检索 / 图谱 / 收藏夹 / 备份 / 通知、音乐库、影视库、管理员面板' },
      { type: 'feat', text: '上线自定义域名（Pages + Worker）与证书' },
      { type: 'feat', text: '新增 SaaS 液态玻璃风格改造 + 落地页，品牌更名为 Dora 并自托管字体' },
      { type: 'feat', text: '新增现代线性图标系统（全内联 SVG，无外部请求）' },
      { type: 'feat', text: '音乐改为多源聚合（GD 音乐台无损音源 + iTunes / Deezer 封面 + LRCLIB 歌词），并新增 /api/music/stream 重解析直链' },
      { type: 'feat', text: '影视改为 5 个采集源并发聚合，新增动漫类目搜索与元数据补全（Cinemeta / Bangumi / Kitsu）' },
      { type: 'improve', text: '同名同歌手去重合并：播放地址与音质取更优一侧，封面 / 专辑 / 时长互补' }
    ]
  }
];

// 四种变更类型。icon 取自 frontend/src/components/Icon.jsx 里真实存在的名字。
// color 是局部强调色（不是主题色），选的都是中等饱和度，在纯净（白底）与素雅（米底）两套主题下都能看清。
export const CHANGE_TYPES = {
  feat: { key: 'feat', label: '新增', icon: 'sparkles', color: '#16a34a' },
  improve: { key: 'improve', label: '改进', icon: 'sliders', color: '#d97706' },
  fix: { key: 'fix', label: '修复', icon: 'alert', color: '#dc2626' },
  remove: { key: 'remove', label: '移除', icon: 'trash', color: '#7c3aed' }
};

/** 变更类型在卡片里的显示顺序 */
export const CHANGE_TYPE_ORDER = ['feat', 'improve', 'fix', 'remove'];

// 按日期倒序排序（不改原数组）。
// 同一天的多条记录保持传入顺序 —— Array.prototype.sort 自 ES2019 起是稳定排序，
// 所以只要传入时同日期内已是「最新在前」，排完就不会乱。
export function sortVersions(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  return arr.sort((a, b) => {
    const da = String(a && a.date ? a.date : '');
    const db = String(b && b.date ? b.date : '');
    if (da === db) return 0;
    return da < db ? 1 : -1;
  });
}

// 总览统计：共几版 / 首次发布日期 / 最新更新日期 / 总条目数 / 四类各多少
export function changelogStats(list) {
  const arr = Array.isArray(list) ? list : [];
  const byType = { feat: 0, improve: 0, fix: 0, remove: 0 };
  let totalChanges = 0;
  let firstDate = '';
  let lastDate = '';

  for (const v of arr) {
    if (!v) continue;
    const date = formatDate(v.date);
    if (date) {
      if (!firstDate || date < firstDate) firstDate = date;
      if (!lastDate || date > lastDate) lastDate = date;
    }
    const changes = Array.isArray(v.changes) ? v.changes : [];
    for (const c of changes) {
      if (!c) continue;
      totalChanges += 1;
      if (Object.prototype.hasOwnProperty.call(byType, c.type)) byType[c.type] += 1;
    }
  }

  return { versions: arr.length, firstDate, lastDate, totalChanges, byType };
}

// 按类型与关键词过滤。
// - type 为 'all' / 空 / 未知 → 不过滤类型
// - query 为空 → 不过滤关键词；否则大小写不敏感地匹配变更条目的 text
// 返回新的版本数组；某一版过滤后没有条目就整版不返回（不保留空卡片）。
export function filterChanges(list, options) {
  const arr = Array.isArray(list) ? list : [];
  const opts = options || {};
  const type = opts.type && opts.type !== 'all' ? String(opts.type) : '';
  const query = opts.query ? String(opts.query).trim().toLowerCase() : '';
  if (!type && !query) return arr.slice();

  const out = [];
  for (const v of arr) {
    if (!v) continue;
    const changes = (Array.isArray(v.changes) ? v.changes : []).filter((c) => {
      if (!c) return false;
      if (type && c.type !== type) return false;
      if (query && !String(c.text || '').toLowerCase().includes(query)) return false;
      return true;
    });
    if (changes.length > 0) out.push({ ...v, changes });
  }
  return out;
}

// 日期格式化：'2026-10-11' 原样返回；Date 或可解析的时间串转成 YYYY-MM-DD；解析不出来返回空串。
export function formatDate(iso) {
  if (iso == null || iso === '') return '';
  if (iso instanceof Date) {
    if (Number.isNaN(iso.getTime())) return '';
    return ymd(iso.getFullYear(), iso.getMonth() + 1, iso.getDate());
  }
  const raw = String(iso).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
