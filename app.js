/**
 * 科学的想象力 - 卡片堆叠展示网站
 * 
 * 核心功能：
 * 1. 卡片堆叠效果（Stack Card）
 * 2. 拖拽交互 + 飞走动画
 * 3. 键盘 ← → 翻卡
 * 4. 三维度筛选：年龄 / 分议题 / 场次
 * 5. 循环展示 + 打乱
 * 6. 进度追踪
 * 7. 散落标签浮在卡片周围
 * 8. 灵感碰撞——随机两张不同议题卡片并排显示
 */

// ====== 全局状态 ======
let allQuotes = [];
let displayCards = [];     // 当前展示的卡片数据（已筛选）
let currentIndex = 0;      // 当前顶部卡片索引
let cardElements = [];     // DOM 元素引用

// 三维度筛选状态
let filterState = {
  ageGroup: null,      // 选中的年龄段
  subTopic: null,      // 选中的分议题
  sessionName: null,   // 选中的场次名称
};

// 配置
const CONFIG = {
  stackOffset: 6,
  stackScale: 0.96,
  stackRotation: 1.2,
  dragThreshold: 100,
  rotationFactor: 0.15,
};

const DIM_ICONS = { ageGroup: '👦', subTopic: '💡', sessionName: '📚' };

// ====== 初始化 ======

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initKeyboard();
});

function loadData() {
  const previewData = sessionStorage.getItem('preview_quotes');
  if (previewData) {
    try { allQuotes = JSON.parse(previewData); } catch(e) {}
  }
  
  if (typeof QUOTES_DATA !== 'undefined' && QUOTES_DATA.length > 0) {
    if (allQuotes.length === 0) {
      allQuotes = QUOTES_DATA;
    } else {
      const existing = new Set(allQuotes.map(q => `${q.quote}|${q.topic}`));
      QUOTES_DATA.forEach(q => {
        const key = `${q.quote}|${q.topic}`;
        if (!existing.has(key)) allQuotes.push(q);
      });
    }
  }

  setTimeout(() => {
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => document.getElementById('loading').remove(), 500);
  }, 400);

  buildFilterBar();
  applyFilters();
}

// ====== 筛选栏构建 ======

function buildFilterBar() {
  const bar = document.getElementById('filter-bar');

  // 从数据中提取各维度的唯一值
  const ageGroups = [...new Set(allQuotes.map(q => q.speaker?.ageGroup).filter(Boolean))].sort();
  const subTopics = [...new Set(allQuotes.map(q => q.subTopic).filter(Boolean))].sort();
  const sessionNames = [...new Set(allQuotes.map(q => q.session?.name).filter(Boolean))].sort();

  let html = '';

  // 年龄段组
  if (ageGroups.length > 0) {
    html += `<div class="filter-group">
      <span class="filter-label">${DIM_ICONS.ageGroup} 年龄</span>`;
    html += `<button class="filter-btn f-age ${!filterState.ageGroup ? 'active' : ''}" data-dim="ageGroup" data-val="">全部</button>`;
    ageGroups.forEach(val => {
      html += `<button class="filter-btn f-age ${filterState.ageGroup === val ? 'active' : ''}" data-dim="ageGroup" data-val="${escapeAttr(val)}">${val}</button>`;
    });
    html += `</div>`;
  }

  // 分议题组
  if (subTopics.length > 0) {
    html += `<div class="filter-group">
      <span class="filter-label">${DIM_ICONS.subTopic} 议题</span>`;
    html += `<button class="filter-btn f-topic ${!filterState.subTopic ? 'active' : ''}" data-dim="subTopic" data-val="">全部</button>`;
    subTopics.forEach(val => {
      html += `<button class="filter-btn f-topic ${filterState.subTopic === val ? 'active' : ''}" data-dim="subTopic" data-val="${escapeAttr(val)}">${val}</button>`;
    });
    html += `</div>`;
  }

  // 场次组（文本标题）
  if (sessionNames.length > 0) {
    html += `<div class="filter-group">
      <span class="filter-label">${DIM_ICONS.sessionName} S602 想象与自然：歌德与洪堡</span>`;
    html += `<button class="filter-btn f-session ${!filterState.sessionName ? 'active' : ''}" data-dim="sessionName" data-val="">全部</button>`;
    sessionNames.forEach(val => {
      html += `<button class="filter-btn f-session ${filterState.sessionName === val ? 'active' : ''}" data-dim="sessionName" data-val="${escapeAttr(val)}">${val}</button>`;
    });
    html += `</div>`;
  }

  // 重置按钮
  if (html) {
    html += `<button class="filter-reset" onclick="resetFilters()">↺ 重置筛选</button>`;
  }

  bar.innerHTML = html;

  // 绑定事件
  bar.querySelectorAll('.filter-btn[data-dim]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dim = btn.dataset.dim;
      const val = btn.dataset.val; // "" 表示该维度选"全部"

      // 更新同维度按钮的激活状态
      bar.querySelectorAll(`[data-dim="${dim}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      filterState[dim] = val || null;
      applyFilters();
    });
  });
}

function resetFilters() {
  filterState = { ageGroup: null, subTopic: null, sessionName: null };
  buildFilterBar();
  applyFilters();
  showToast('🔄 已重置筛选');
}

// ====== 应用筛选 ======

function applyFilters() {
  displayCards = allQuotes.filter(q => {
    if (filterState.ageGroup && q.speaker?.ageGroup !== filterState.ageGroup) return false;
    if (filterState.subTopic && q.subTopic !== filterState.subTopic) return false;
    if (filterState.sessionName && q.session?.name !== filterState.sessionName) return false;
    return true;
  });

  shuffleArray(displayCards);
  currentIndex = 0;
  updateCounter();
  renderStack();
  renderDots();
  renderFloatingTags(); // 渲染散落标签
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function shuffleCards() {
  if (displayCards.length <= 1) return;
  
  // 收集未看过的卡片重新打乱
  const remaining = displayCards.slice(currentIndex);
  shuffleArray(remaining);
  displayCards = [...displayCards.slice(0, currentIndex), ...remaining];
  
  // 动画效果：当前卡片快速翻转
  const topCard = cardElements[cardElements.length - 1];
  if (topCard) {
    topCard.style.transition = 'transform 0.3s ease';
    topCard.style.transform += ' rotateY(180deg)';
    setTimeout(() => {
      renderStack();
    }, 300);
  }
  
  showToast('🔀 已重新打乱！');
}

// ====== 渲染卡片堆栈 ======

function renderStack() {
  const container = document.getElementById('stack');
  container.innerHTML = '';
  cardElements = [];

  // 只渲染当前及之后的卡片（最多5张可见）
  const visibleCount = Math.min(displayCards.length - currentIndex, 5);
  if (visibleCount === 0) {
    showAllDone();
    return;
  }

  for (let i = 0; i < visibleCount; i++) {
    const dataIndex = currentIndex + i;
    const quote = displayCards[dataIndex];
    const isTop = i === visibleCount - 1;
    
    const card = createCardElement(quote, dataIndex, isTop, i, visibleCount);
    container.appendChild(card);
    cardElements.push(card);

    if (isTop) {
      initDrag(card, dataIndex);
    }
  }

  hideAllDone();
}

function createCardElement(quote, index, isTop, layerPos, totalVisible) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.index = index;

  // 计算堆叠位置
  const offsetFromBack = totalVisible - 1 - layerPos;
  const scale = Math.pow(CONFIG.stackScale, offsetFromBack);
  const rot = (Math.random() - 0.5) * 2 * CONFIG.stackRotation * offsetFromBack;
  const transY = offsetFromBack * CONFIG.stackOffset;
  const transX = (Math.random() - 0.5) * offsetFromBack * 8;

  card.style.transform = `translate(${transX}px, ${transY}px) scale(${scale}) rotate(${rot}deg)`;
  card.style.zIndex = layerPos;

  // 根据主题生成彩虹色相（基于文本哈希）
  let hue = 220; // 默认蓝
  if (quote.topic) {
    let hash = 0;
    for (let i = 0; i < quote.topic.length; i++) hash = quote.topic.charCodeAt(i) + ((hash << 5) - hash);
    hue = Math.abs(hash) % 360;
  }

  card.innerHTML = `
    <div class="card-body">
      <div class="card-quote" style="--card-hue: ${hue}deg;">${escapeHtml(quote.quote)}</div>
      
      <div class="context-toggle" id="ctx-toggle-${index}">
        <button class="ctx-toggle-btn" onclick="toggleContext(${index})">
          💬 展开讨论上下文
        </button>
        <div class="context-panel" id="ctx-panel-${index}">
          ${quote.context?.before ? `<div class="context-text ctx-before"><strong>讨论前因：</strong>${escapeHtml(quote.context.before)}</div>` : ''}
          ${quote.context?.after ? `<div class="context-text ctx-after"><strong>讨论后续：</strong>${escapeHtml(quote.context.after)}</div>` : ''}
          ${(!quote.context?.before && !quote.context?.after) ? '<div class="context-text" style="color:#C5CCD0">暂无上下文记录</div>' : ''}
        </div>
      </div>
    </div>
    <div class="card-footer">
      <div class="card-meta card-meta-sub">
        ${quote.subTopic ? `<span class="meta-badge">💡 ${escapeHtml(quote.subTopic)}</span>` : ''}
        ${quote.speaker?.nickname || quote.speaker?.ageGroup ? `<span class="meta-badge age">${escapeHtml(quote.speaker.nickname || '')} ${quote.speaker.ageGroup || ''}</span>` : ''}
      </div>
    </div>
    
    ${isTop ? '<div class="drag-hint"><span class="drag-arrows">← →</span> 拖动或按方向键</div>' : ''}
    
    <!-- 看完所有卡片的覆盖层 -->
    <div class="all-done-overlay" id="alldone-overlay">
      <div class="all-done-content">
        <span class="done-emoji">🎉</span>
        <div class="done-title">太棒了！全部看完！</div>
        <div class="done-desc">${displayCards.length} 则少年妙语的思辨之旅结束了<br>孩子们的智慧总是让人惊喜</div>
        <button class="done-btn" onclick="restartFromStart()">再来一轮 🔄</button>
      </div>
    </div>
  `;

  return card;
}

// ====== 上下文展开 ======

let openContextIndex = null;

function toggleContext(index) {
  const panel = document.getElementById(`ctx-panel-${index}`);
  const toggleBtn = document.querySelector(`#ctx-toggle-${index} .ctx-toggle-btn`);
  
  if (openContextIndex !== null && openContextIndex !== index) {
    // 关闭之前打开的
    const prevPanel = document.getElementById(`ctx-panel-${openContextIndex}`);
    const prevBtn = document.querySelector(`#ctx-toggle-${openContextIndex} .ctx-toggle-btn`);
    if (prevPanel) prevPanel.classList.remove('open');
    if (prevBtn) prevBtn.textContent = '💬 展开讨论上下文';
  }

  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
    toggleBtn.textContent = '💬 展开讨论上下文';
    openContextIndex = null;
  } else {
    panel.classList.add('open');
    toggleBtn.textContent = '▲ 收起上下文';
    openContextIndex = index;
  }
}

// ====== 拖拽逻辑 ======

function initDrag(element, dataIndex) {
  let startX, startY;
  let currentX = 0;
  let currentY = 0;
  let isDragging = false;
  let hasMovedEnough = false;

  const onStart = (e) => {
    if (element.classList.contains('fly-left') || element.classList.contains('fly-right')) return;
    
    isDragging = true;
    hasMovedEnough = false;
    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    currentX = 0;
    currentY = 0;
    
    element.style.transition = 'none';
    element.style.cursor = 'grabbing';
    
    e.preventDefault();
  };

  const onMove = (e) => {
    if (!isDragging) return;
    
    const point = e.touches ? e.touches[0] : e;
    currentX = point.clientX - startX;
    currentY = point.clientY - startY;
    
    hasMovedEnough = Math.abs(currentX) > 10;
    
    const rotation = currentX * CONFIG.rotationFactor;
    const scale = 1 - Math.abs(currentX) / 2000;
    
    element.style.transform = `
      translate(${currentX}px, ${currentY}px)
      rotate(${rotation}deg)
      scale(${Math.max(scale, 0.9)})
    `;
    
    // 根据方向改变透明度暗示
    const absX = Math.abs(currentX);
    const opacity = Math.max(1 - absX / 300, 0.4);
    element.style.opacity = opacity;
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    
    element.style.cursor = 'grab';
    
    if (Math.abs(currentX) > CONFIG.dragThreshold) {
      // 飞走
      if (currentX > 0) {
        element.classList.add('fly-right');
        handleSwipeRight(dataIndex);
      } else {
        element.classList.add('fly-left');
        handleSwipeLeft(dataIndex);
      }
    } else {
      // 弹回原位
      element.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease';
      element.style.transform = '';
      element.style.opacity = '';
    }
  };

  element.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  
  element.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}

// ====== 翻卡处理 ======

function handleSwipeLeft(index) {
  // 左滑 = 跳过这张（不喜欢/下一张）
  goToNext();
}

function handleSwipeRight(index) {
  // 右滑 = 喜欢这条金句
  spawnConfetti(8); // 少量撒花表示喜欢
  showToast('❤️ 已收藏这条精彩发言');
  goToNext();
}

function goToNext() {
  currentIndex++;
  updateCounter();
  updateDots();

  if (currentIndex >= displayCards.length) {
    showAllDoneOverlay();
    return;
  }

  // 移除最前面的卡片（已飞走的），让后面的卡片重新排列
  setTimeout(() => {
    renderStack();
  }, 450);
}

function goPrev() {
  if (currentIndex > 0) {
    currentIndex--;
    updateCounter();
    updateDots();
    renderStack();
  }
}

// ====== 键盘支持 ======

function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        swipeCurrentLeft();
        break;
      case 'ArrowRight':
        e.preventDefault();
        swipeCurrentRight();
        break;
      case ' ':
        e.preventDefault();
        shuffleCards();
        break;
      case 'Escape':
        if (isCollisionMode) {
          closeCollision();
        } else if (openContextIndex !== null) {
          toggleContext(openContextIndex);
        }
        break;
    }
  });

  // 也支持 A/D 键
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'a') { e.preventDefault(); swipeCurrentLeft(); }
    if (e.key.toLowerCase() === 'd') { e.preventDefault(); swipeCurrentRight(); }
    // ESC 关闭阅读弹窗
    if (e.key === 'Escape') { closeReadingPanel(); }
  });

  // 点击遮罩关闭阅读弹窗
  const readingPanel = document.getElementById('reading-panel');
  if (readingPanel) {
    readingPanel.addEventListener('click', (e) => {
      if (e.target === readingPanel) { closeReadingPanel(); }
    });
  }
}

function swipeCurrentLeft() {
  const topCard = cardElements[cardElements.length - 1];
  if (topCard && !topCard.classList.contains('fly-left') && !topCard.classList.contains('fly-right')) {
    topCard.classList.add('fly-left');
    const idx = parseInt(topCard.dataset.index);
    setTimeout(() => goToNext(), 450);
  }
}

function swipeCurrentRight() {
  const topCard = cardElements[cardElements.length - 1];
  if (topCard && !topCard.classList.contains('fly-left') && !topCard.classList.contains('fly-right')) {
    topCard.classList.add('fly-right');
    spawnConfetti(12);
    showToast('❤️ 这条很棒！');
    const idx = parseInt(topCard.dataset.index);
    setTimeout(() => goToNext(), 450);
  }
}

/* 箭头按钮导航 */
function navigateCard(dir) {
  if (dir < 0) {
    goPrev();
  } else {
    swipeCurrentRight();
  }
}

/* ====== 阅读文本弹窗 ====== */
const READING_TEXT = `S602．想象与自然：歌德与洪堡
节选自：《创造自然：亚历山大 · 冯 · 洪堡的科学发现之旅》
作者：【德】安德烈娅·武尔夫  体裁：科学史/思想传记

洪堡所见的歌德性情沉静，略微发胖，有双下巴和肚腩——有人不客气地将之比作"到了孕晚期的妇人"。他的相貌也已不复当年"太阳神阿波罗"般的英俊，双眼眯缝到了"鼓胀的双颊"里。歌德仍然是萨克森－魏玛公爵的心腹和顾问，并被后者册封为贵族（因此他的姓名被写作约翰·沃尔夫冈·"冯"·歌德）。他指导宫廷剧团，同时身兼若干个待遇优厚的职位，包括总管公爵领地中的矿山和手工业生产。和洪堡一样，他对地质学（以及矿业）兴趣浓厚，甚至曾经让自己的儿子穿着矿工的工作服出席特定的场合。

歌德冠绝群才，已经成为德国知识界中天神宙斯一样的人物，但却"冷漠，惜字如金"。有人形容他看上去十分忧郁，有人说他傲慢、尖刻。如果谈话无法引起他的兴趣，他就会失去倾听的耐心，或突然转换话题。他对待年轻诗人和学者尤其粗鲁，常常逼得他们不得不灰溜溜地离开。但无论如何，崇拜者仍然蜂拥而至：一位英国来客曾说，在荷马、塞万提斯和莎士比亚之后，"诗歌的神圣之火"终于传递到了歌德手中。

但歌德并不幸福："那时，没有人比我更孤立了。"比起人类，他更着迷于自然——这位"伟大的母亲"。他位于魏玛城中心的大宅反映了主人的品位和社会地位：室内装潢优雅，陈列着画作、意大利雕塑，以及大量的岩石、化石与植物标本。宅子背后的一系列朴素的小房间都是书房和图书馆，俯瞰着歌德自行设计的、有科学研究用途的花园；花园一角的小楼则存放着数量庞大的地质标本。

歌德最喜欢的地方是位于老城墙外公爵领地上的一处花园别墅，那里毗邻伊尔姆河。从他城里的大宅出发，步行10分钟即可到达这间舒适的小屋——歌德刚到魏玛时的住所。现在，他在此躲避络绎不绝的访客，自在地写作、打理园圃、接待最亲密的友人。葡萄藤和忍冬爬满了墙与窗棂，园子里有菜地，草坪上有果树，一条长长的步道两边种满了歌德最喜爱的蜀葵。1776年他初到这里时，就亲手栽种了花园中的很多植物，还说服公爵将城堡中原有的旧式巴洛克花园改造成时髦的英式景观园林，其中错落有致的树林给人一种身处大自然之中的风味。

歌德有些"厌倦了世间的纷争"。1789年法国大革命最初的理想主义迅速被其后雅各宾专政下的残酷现实取代，成千上万的"革命敌人"被处决。如此暴行，连同之后拿破仑战争给欧洲带来的劫难，都让歌德感到失望，同时陷入"深深的忧郁"之中。当各国军队在欧洲战场上厮杀，他时刻都在担心德国可能面临的威胁。他深居简出，像个隐士，唯有科学研究能让他专注其中。科学对他来说就像是"沉船后抓住的一块木板"。

今天，歌德以其文学作品闻名于世，但少有人知道，他对科学也曾全情投入，尤其着迷于地球的形成问题与植物学。他的岩石样本收藏最终超过了18000件。欧洲的战火不断蔓延，他则静静地钻研比较解剖学与光学。洪堡初次到访那年，歌德刚刚在耶拿大学创建了一个植物园，之前还撰写了题为《植物之变形》（Metamorphosis of Plants）的论文。他在文中提出了这样一个观点：多姿多彩的植物世界实际上共享一种"原型"（Urform），或原始的形式；每一种不同的植物都是这一"原型"的一种变体。多样性的背后存在着统一性。歌德认为，叶片是最基本的"原型"，由它衍生出其他器官，如花瓣、花萼等。他写道："植物的里里外外都由叶片组成。"

这些想法令人兴奋，但歌德缺少一个旗鼓相当的谈话对象来进一步推演他的理论。洪堡的到来改变了一切，他们的思想碰撞出了久违的火花。有洪堡在场，歌德的思维变得更加活跃：他翻出旧时的笔记、书籍和素描，将各种纸张成堆地摞在书桌上。他们讨论动物学和植物学理论，时而埋头写写画画，时而大声朗读。歌德对分类学不感兴趣，但着迷于形塑生物体的力。他将内在的力（生物体的"原型"）与外在的力（影响生物本身的环境）区分开来。例如一头海豹，它有适应海洋生境（外在的力）的身体，但与此同时，它的骨骼呈现出与陆地上的哺乳动物相同的样式（内在的力）。歌德认识到，植物和动物都与其生境相适应，这一点与法国自然学家让-巴蒂斯特·拉马克和后来的查尔斯·达尔文的看法类似。他写道，"原型"出现在所有生命体的不同发育阶段，甚至也能在动物与人类之间找到共性。

洪堡听着歌德兴奋地讲述自己的想法，建议他将自己的理论写成一篇比较解剖学的文章发表。于是歌德开始狂热地工作，每天清晨花几小时在卧室里向助手口述。为了抵御寒冷，他半靠在床头，裹着毯子，头脑飞速运转——这是多年未曾出现过的情形了。没过多久就到了上午十时，洪堡准时到访，然后继续讨论。

从这些日子起，歌德散步的时候会同时摆动两条胳膊，引得邻居纷纷注目。在众人的询问下，他终于解释道，这是因为他发现夸张地摆动手臂是从四足动物继承来的遗存，也就是人与动物有共同祖先的明证。他说："我这样走路更自然。"毫不在乎魏玛上流社会评价他的怪样子太粗野。

此后几年中，洪堡一有机会就到耶拿和魏玛拜访歌德。他们一起散步、用餐、开展科学实验，并参观耶拿的新植物园。歌德精神焕发，不停地变换话题，"早上先推敲诗句，然后解剖青蛙"是洪堡来访期间歌德日记中的典型记载。他对友人说，洪堡让他不断地产生新想法，甚至头晕目眩——他从未碰到过如此全能的人。洪堡的勤奋"鞭打着科学的事物"飞速前行，有时一不注意就难以跟上他的思路。

一天早晨，洪堡将一条解剖下来的青蛙腿放在玻璃板上，用不同的金属将它的肌肉和神经连接起来；他尝试了银、金、铁、锌等，但只能让蛙腿轻微地动一动。他俯身想去检查装置的连接情况，却意外地发现蛙腿开始剧烈收缩，甚至直接从桌面上跳了下去。二人都惊讶莫名。洪堡后来意识到，一定是他呼吸产生的水汽触发了这一反应：微小的水滴碰触到金属，形成了触动蛙腿的电流。洪堡认定这是他生平做过的最神奇的实验，好像在呼吸间将"生命的气息"吹进了青蛙死去的躯体。

与此相关，他们也讨论了洪堡先前的老师布卢门巴赫关于生物体内"形成力"的学说。歌德相当兴奋，并将这些理论应用到了自己关于"原型"的想法中。他写道，一定是"形成力"触发了"原型"中某些部分的发育。例如蛇的脖颈如此之长，一定是因为"没有把物质或力"浪费在手臂和腿的发育上；而蜥蜴的脖颈如此之短，是因为它同时长了四条腿；青蛙的脖颈更短，因为它的腿更长。

不同于笛卡尔把生物体看作机器，歌德坚信，生物有机体由各部分组成，但只有合为一个整体时才会运转。简单地说，机器可以拆开重组，但生物有机体的各个器官只有相互依存才能运行。在机械系统里，部分形塑整体；而在有机体内部，整体形塑部分。

洪堡进一步拓宽了这一观念。虽然他自己关于"动物电"的理论最终被证明是错误的，但这些经历却也给他未来关于自然的观念打下了基础。布卢门巴赫等其他科学家将"力"的观念应用在生物体内，洪堡则将目光转向更宽泛意义上的自然——将整个自然界解释为一个有机的整体，认为其中有相互关联的动力。这种新想法改变了他的研究手段。如果事物都相互关联，那么在研究它们之间的异同时，不应失去整体观。比较（comparison）成了洪堡理解自然的首要工具，而非抽象的数学或数字。`;

function openReadingPanel() {
  const panel = document.getElementById('reading-panel');
  const contentEl = document.getElementById('reading-content');
  if (!panel) return;
  contentEl.textContent = READING_TEXT;
  panel.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeReadingPanel() {
  const panel = document.getElementById('reading-panel');
  if (!panel) return;
  panel.classList.remove('show');
  document.body.style.overflow = '';
}

// ====== 进度 & UI 更新 ======

function updateCounter() {
  document.getElementById('current-num').textContent = Math.min(currentIndex + 1, displayCards.length);
  document.getElementById('total-num').textContent = displayCards.length;
}

function renderDots() {
  const container = document.getElementById('progress-dots');
  const count = Math.min(displayCards.length, 15); // 最多显示15个点
  
  container.innerHTML = Array.from({ length: count }, (_, i) => {
    const globalIndex = Math.floor((i / count) * displayCards.length);
    let cls = 'dot';
    if (globalIndex < currentIndex) cls += ' done';
    else if (globalIndex === currentIndex) cls += ' active';
    return `<div class="${cls}" onclick="jumpToCard(${globalIndex})"></div>`;
  }).join('');
}

function updateDots() {
  const dots = document.querySelectorAll('.dot');
  const count = dots.length;
  dots.forEach((dot, i) => {
    const globalIndex = Math.floor((i / count) * displayCards.length);
    dot.className = 'dot';
    if (globalIndex < currentIndex) dot.classList.add('done');
    else if (globalIndex === currentIndex) dot.classList.add('active');
  });
}

function jumpToCard(targetIndex) {
  if (targetIndex >= 0 && targetIndex < displayCards.length) {
    currentIndex = targetIndex;
    updateCounter();
    updateDots();
    renderStack();
  }
}

function restartFromStart() {
  hideAllDoneOverlay();
  // 重新打乱并从头开始
  shuffleArray(displayCards);
  currentIndex = 0;
  updateCounter();
  renderStack();
  renderDots();
  spawnConfetti(30);
}

// ====== 完成状态 ======

function showAllDone() {
  // 无数据时显示空状态
  const container = document.getElementById('stack');
  container.innerHTML = `
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.9);border-radius:20px;">
      <div style="text-align:center;padding:40px;">
        <div style="font-size:48px;margin-bottom:12px;">📝</div>
        <div style="font-size:18px;font-weight:600;color:#202124;margin-bottom:8px;">还没有金句</div>
        <div style="font-size:14px;color:#5F6368;">使用金句提取工具录入后刷新页面即可查看</div>
      </div>
    </div>
  `;
}

function showAllDoneOverlay() {
  const overlay = document.getElementById('alldone-overlay');
  if (overlay) overlay.classList.add('show');
  spawnConfetti(50); // 大量撒花庆祝完成
}

function hideAllDoneOverlay() {
  document.querySelectorAll('.all-done-overlay.show').forEach(el => el.classList.remove('show'));
}

function hideAllDone() {
  // 由 renderStack 内部调用，确保不显示空态
}

// ====== 分享功能 ======

function shareCurrent() {
  if (currentIndex >= displayCards.length) return;
  const q = displayCards[currentIndex];
  const text = `"${q.quote}"\n\n—— 来自「${q.topic}」讨论会 · 思辨现场`;

  if (navigator.share) {
    navigator.share({
      title: `思辨现场 - ${q.topic}`,
      text: text,
    }).catch(() => {});
  } else {
    // 复制到剪贴板
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 已复制到剪贴板！');
    }).catch(() => {
      fallbackShare(text);
    });
  }
}

function fallbackShare(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('📋 已复制到剪贴板！');
}

// ====== 撒花效果 ======

function spawnConfetti(count = 20) {
  const container = document.getElementById('confetti');
  const colors = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#AA60D5', '#FF6B6B', '#4ECDC4'];
  
  for (let i = 0; i < count; i++) {
    const conf = document.createElement('div');
    conf.className = 'confetti';
    conf.style.left = Math.random() * 100 + '%';
    conf.style.background = colors[Math.floor(Math.random() * colors.length)];
    conf.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    conf.style.animationDelay = Math.random() * 0.5 + 's';
    conf.style.width = (6 + Math.random() * 10) + 'px';
    conf.style.height = (6 + Math.random() * 10) + 'px';
    conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    container.appendChild(conf);
    
    // 清理
    setTimeout(() => conf.remove(), 4500);
  }
}

// ====== Toast 提示 ======

let toastTimer = null;

function showToast(msg) {
  // 移除已有
  document.querySelectorAll('.toast-msg').forEach(t => t.remove());
  
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(32,33,36,0.88)',
    color: 'white',
    padding: '10px 24px',
    borderRadius: '24px',
    fontSize: '13px',
    fontWeight: '500',
    zIndex: '9999',
    animation: 'toastIn 0.3s ease-out',
    whiteSpace: 'nowrap',
  });
  toast.textContent = msg;
  document.body.appendChild(toast);
  
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, 1800);
}

// 注入动画样式
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  @keyframes toastOut { from { opacity: 1; transform: translateX(-50%) translateY(0); } to { opacity: 0; transform: translateX(-50%) translateY(12px); } }
`;
document.head.appendChild(toastStyle);

// ====== 散落标签（Google Doodles 风格小卡片，围绕金句卡片散落）======

function renderFloatingTags() {
  const container = document.getElementById('floating-tags');
  if (!container) return;
  container.innerHTML = '';

  // 只取分议题作为核心标签（最符合 Doodle 卡片风格）
  const tags = [];
  displayCards.forEach(q => {
    if (q.subTopic) tags.push({ text: q.subTopic, icon: '💡', type: 'topic' });
  });

  // 去重
  const seen = new Set();
  const uniqueTags = tags.filter(t => {
    const key = t.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 随机取最多 10 个议题卡片
  const selected = shuffleArray([...uniqueTags]).slice(0, Math.min(10, uniqueTags.length));

  // 装饰色板（Google Doodle 风格的柔和彩色）
  const accentColors = [
    '#F5B941', /* 金 */
    '#F093FB', /* 粉 */
    '#667eea', /* 蓝 */
    '#4ECDC4', /* 青 */
    '#FF6B6B', /* 红 */
    '#95E1D3', /* 薄荷绿 */
    '#C9A0DC', /* 淡紫 */
    '#FFAB91', /* 橙 */
    '#80DEEA', /* 天蓝 */
    '#A5D6A7', /* 浅绿 */
    '#F48FB1', /* 粉红 */
    '#90CAF9', /* 浅蓝 */
  ];

  // 位置配置：以主卡片为中心区域散落（参考 Google Doodles 截图布局）
  // 主卡片大约在屏幕中央偏上区域
  const positions = [
    // 左侧
    { top: '18%', left: '2%', rot: -8, side: 'left' },   // 左上外
    { top: '36%', left: '-0.5%', rot: -4, side: 'left' },  // 左中
    { top: '56%', left: '3%', rot: -7, side: 'left' },     // 左下
    // 右侧
    { top: '14%', right: '2.5%', rot: 7, side: 'right' },  // 右上外
    { top: '34%', right: '0.5%', rot: 4, side: 'right' },  // 右中
    { top: '54%', right: '3%', rot: 8, side: 'right' },    // 右下
    // 上方
    { top: '8%', left: '18%', rot: -3, side: 'top' },
    { top: '6%', right: '20%', rot: 5, side: 'top' },
    // 下方
    { bottom: '12%', left: '15%', rot: -5, side: 'bottom' },
    { bottom: '8%', right: '16%', rot: 6, side: 'bottom' },
  ];

  selected.forEach((tag, i) => {
    const pos = positions[i % positions.length];
    const accent = accentColors[i % accentColors.length];
    
    const el = document.createElement('div');
    el.className = `floating-tag tag-${pos.side}`;
    el.innerHTML = `${tag.icon} ${escapeHtml(tag.text)}`;
    
    // 设置旋转角度和位置
    el.style.setProperty('--rot', `${pos.rot}deg`);
    el.style.setProperty('--card-accent', accent);
    el.style.top = pos.top;
    if (pos.left !== undefined) el.style.left = pos.left;
    if (pos.right !== undefined) el.style.right = pos.right;
    if (pos.bottom !== undefined) el.style.bottom = pos.bottom;
    
    // 错开进入动画时间
    el.style.animationDelay = `${i * 0.1}s`;
    
    // 随机微调尺寸让卡片看起来更自然
    const scaleVar = 0.85 + Math.random() * 0.25;
    el.style.setProperty('--card-scale', scaleVar);
    
    container.appendChild(el);
  });
}

// ====== 灵感碰撞功能 ======

let isCollisionMode = false;

function startCollision() {
  isCollisionMode = true;
  
  // 确保至少有 2 个不同议题的数据
  const topics = [...new Set(displayCards.map(q => q.subTopic).filter(Boolean))];
  if (topics.length < 2) {
    showToast('⚠️ 至少需要两个不同议题才能碰撞！');
    return;
  }

  // 随机选两个不同议题的卡片
  let cardA, cardB;
  let attempts = 0;
  do {
    const shuffled = [...displayCards].sort(() => Math.random() - 0.5);
    cardA = shuffled[0];
    cardB = shuffled.find(q => q.subTopic !== cardA.subTopic);
    attempts++;
  } while (!cardB && attempts < 50);

  if (!cardB) cardB = displayCards[Math.floor(Math.random() * displayCards.length)];

  // 渲染碰撞面板
  renderCollisionCards(cardA, cardB);

  const overlay = document.getElementById('collision-overlay');
  overlay.classList.add('show');
  
  // 增强版撒花 + 火花特效
  spawnConfetti(25);
  setTimeout(() => spawnCollisionSparks(), 300);
  showToast('💥 灵感碰撞！寻找跨学科的联系');
}

// 碰撞火花特效（沿对角线散开的小火花）
function spawnCollisionSparks() {
  const container = document.getElementById('confetti');
  if (!container) return;
  
  for (let i = 0; i < 12; i++) {
    const spark = document.createElement('div');
    spark.style.cssText = `
      position: fixed;
      width: ${4 + Math.random() * 6}px;
      height: ${4 + Math.random() * 6}px;
      border-radius: 50%;
      background: linear-gradient(135deg, #F5B941, #F093FB, #667eea)[${Math.floor(Math.random() * 3)}];
      pointer-events: none;
      z-index: 210;
      left: 50%;
      top: 45%;
      box-shadow: 0 0 8px rgba(245,185,65,0.6), 0 0 16px rgba(240,147,251,0.3);
    `;
    
    // 随机选择纯色
    const colors = ['#F5B941', '#F093FB', '#667eea', '#fff', '#FFD700'];
    spark.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const velocity = 120 + Math.random() * 200;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;
    
    container.appendChild(spark);
    
    spark.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`, opacity: 0 }
    ], {
      duration: 800 + Math.random() * 600,
      easing: 'cubic-bezier(0, 0.55, 0.45, 1)'
    }).onfinish = () => spark.remove();
  }
}

function renderCollisionCards(cardA, cardB) {
  const wrap = document.getElementById('collision-cards');
  
  const makeCardHTML = (quote, sideClass) => {
    let hue = 220;
    if (quote.topic) {
      let hash = 0;
      for (let i = 0; i < quote.topic.length; i++) hash = quote.topic.charCodeAt(i) + ((hash << 5) - hash);
      hue = Math.abs(hash) % 360;
    }
    return `
      <div class="collision-card ${sideClass}">
        <div class="card-body">
          <div class="card-quote" style="--card-hue: ${hue}deg;">${escapeHtml(quote.quote)}</div>
        </div>
        <div class="card-footer">
          <div class="card-meta">
            <span class="meta-badge topic">📚 ${escapeHtml(quote.topic)}</span>
          </div>
          <div class="card-meta card-meta-sub">
            ${quote.subTopic ? `<span class="meta-badge">💡 ${escapeHtml(quote.subTopic)}</span>` : ''}
            ${quote.speaker?.nickname ? `<span class="meta-badge">🗣️ ${quote.speaker.nickname}</span>` : ''}
          </div>
        </div>
      </div>`;
  };

  wrap.innerHTML = `
    ${makeCardHTML(cardA, '')}
    <div class="collision-connector">
      <div class="collision-connector-inner">⚡</div>
    </div>
    ${makeCardHTML(cardB, 'card-b')}
  `;
}

function closeCollision() {
  const overlay = document.getElementById('collision-overlay');
  overlay.classList.remove('show');
  isCollisionMode = false;
}

// Escape 键关闭碰撞面板（扩展已有键盘逻辑）
const origKeyboard = initKeyboard;
// 在键盘处理中增加 ESC 关闭碰撞面板的逻辑已在 initKeyboard 中支持

// ====== 工具函数 ======

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&#39;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
