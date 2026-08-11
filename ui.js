import * as audio from "./audio.js";
import { loadSave, persist, resetProgress, SHOP_ITEMS, shopItemCost } from "./storage.js";
import { ICONS } from "./upgrades.js";

const BOMB_CIRCUMFERENCE = 2 * Math.PI * 29;

function $(id) { return document.getElementById(id); }

export function initUI(game, input) {
  const el = {
    hud: $("hud"),
    hudScore: $("hud-score-value"),
    hudWave: $("hud-wave-value"),
    hudDust: $("hud-dust-value"),
    hudLives: $("hud-lives"),
    comboBadge: $("combo-badge"),
    comboValue: $("combo-value"),
    bombBtn: $("btn-bomb"),
    bombProgress: $("bomb-progress"),
    hintToast: $("hint-toast"),
    hitFlash: $("hit-flash"),
    menuHighscore: $("menu-highscore-value"),
    shopDust: $("shop-dust-value"),
    shopList: $("shop-list"),
    levelupCards: $("levelup-cards"),
    goScore: $("go-score"),
    goWave: $("go-wave"),
    goDust: $("go-dust"),
    goHighscoreRow: $("go-highscore-row"),
    rangeSfx: $("range-sfx"),
    rangeMusic: $("range-music"),
    toggleMute: $("toggle-mute"),
    toggleShake: $("toggle-shake"),
    toggleHaptics: $("toggle-haptics"),
  };

  const screens = {};
  document.querySelectorAll(".screen").forEach((s) => { screens[s.id.replace("screen-", "")] = s; });

  let settingsReturn = "menu";
  let hintTimer = null;

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    if (name) screens[name].classList.remove("hidden");
  }

  function setPlayUiVisible(visible) {
    el.hud.classList.toggle("hidden", !visible);
    el.bombBtn.classList.toggle("hidden", !visible);
  }

  function showHint(text, duration) {
    clearTimeout(hintTimer);
    el.hintToast.textContent = text;
    el.hintToast.classList.remove("hidden", "fade");
    hintTimer = setTimeout(() => {
      el.hintToast.classList.add("fade");
      setTimeout(() => el.hintToast.classList.add("hidden"), 450);
    }, duration);
  }

  function applySettingsToUi(settings) {
    el.rangeSfx.value = Math.round(settings.sfx * 100);
    el.rangeMusic.value = Math.round(settings.music * 100);
    el.toggleMute.setAttribute("aria-checked", String(settings.muted));
    el.toggleShake.setAttribute("aria-checked", String(settings.shake));
    el.toggleHaptics.setAttribute("aria-checked", String(settings.haptics));
    audio.setVolumes({ sfx: settings.sfx, music: settings.music, muted: settings.muted });
    game.setSettings({ shake: settings.shake, haptics: settings.haptics });
  }

  function refreshMenu() {
    const save = loadSave();
    el.menuHighscore.textContent = save.highScore.toLocaleString("it-IT");
  }

  function renderShop() {
    const save = loadSave();
    el.shopDust.textContent = save.cosmicDust.toLocaleString("it-IT");
    el.shopList.innerHTML = "";
    for (const item of SHOP_ITEMS) {
      const level = save.shop[item.id] || 0;
      const maxed = level >= item.max;
      const cost = shopItemCost(item, level);
      const row = document.createElement("div");
      row.className = "shop-item";

      const pips = Array.from({ length: item.max }, (_, i) => `<span class="pip ${i < level ? "filled" : ""}"></span>`).join("");
      row.innerHTML = `
        <div class="shop-item-icon">${ICONS[item.id]}</div>
        <div class="shop-item-body">
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-desc">${item.desc}</div>
          <div class="shop-item-pips">${pips}</div>
        </div>
        <button class="shop-item-buy ${maxed ? "maxed" : ""}" ${maxed || save.cosmicDust < cost ? "disabled" : ""}>${maxed ? "MAX" : cost}</button>
      `;
      if (!maxed) {
        row.querySelector(".shop-item-buy").addEventListener("click", () => {
          const s = loadSave();
          const lvl = s.shop[item.id] || 0;
          const c = shopItemCost(item, lvl);
          if (s.cosmicDust < c || lvl >= item.max) return;
          s.cosmicDust -= c;
          s.shop[item.id] = lvl + 1;
          persist();
          audio.sfxUiClick();
          renderShop();
        });
      }
      el.shopList.appendChild(row);
    }
  }

  function renderLevelUpCards(choices) {
    el.levelupCards.innerHTML = "";
    choices.forEach((upg) => {
      const currentLevel = game.player[`${upg.id}Level`] ?? 0;
      const card = document.createElement("button");
      card.className = "levelup-card";
      card.innerHTML = `
        <div class="levelup-card-icon">${upg.icon}</div>
        <div>
          <div class="levelup-card-title">${upg.name}</div>
          <div class="levelup-card-desc">${upg.describe(currentLevel)}</div>
        </div>
      `;
      card.addEventListener("click", () => {
        audio.sfxUiClick();
        game.applyLevelUpChoice(upg.id);
        showScreen(null);
        setPlayUiVisible(true);
      });
      el.levelupCards.appendChild(card);
    });
  }

  function updateHud() {
    const h = game.getHud();
    el.hudScore.textContent = h.score.toLocaleString("it-IT");
    el.hudWave.textContent = h.wave;
    el.hudDust.textContent = h.dust;

    if (el.hudLives.childElementCount !== h.maxLives) {
      el.hudLives.innerHTML = "";
      for (let i = 0; i < h.maxLives; i++) {
        const s = document.createElement("span");
        s.className = "life-icon";
        el.hudLives.appendChild(s);
      }
    }
    Array.from(el.hudLives.children).forEach((child, i) => child.classList.toggle("lost", i >= h.lives));

    el.bombBtn.classList.toggle("charged", h.bombReady);
    el.bombProgress.style.strokeDashoffset = String(BOMB_CIRCUMFERENCE * (1 - h.bombPct));

    el.comboBadge.classList.toggle("hidden", !h.comboActive);
    if (h.comboActive) el.comboValue.textContent = h.combo;
  }

  function hudLoop() {
    if (game.player && game.state !== "menu") updateHud();
    requestAnimationFrame(hudLoop);
  }
  requestAnimationFrame(hudLoop);

  function startNewRun() {
    audio.unlockAudio();
    const save = loadSave();
    if (!save.seenHint) {
      showHint(input.isTouch ? "Trascina per muovere la navicella · Tocca la stella per la Supernova" : "Frecce o A/D per muoverti · Spazio o la stella per la Supernova", 4200);
      save.seenHint = true;
      persist();
    }
    game.startRun();
    showScreen(null);
    setPlayUiVisible(true);
  }

  $("btn-play").addEventListener("click", () => { audio.sfxUiClick(); startNewRun(); });

  $("btn-shop").addEventListener("click", () => { audio.sfxUiClick(); renderShop(); showScreen("shop"); });
  $("btn-shop-back").addEventListener("click", () => { audio.sfxUiClick(); refreshMenu(); showScreen("menu"); });

  $("btn-settings").addEventListener("click", () => { audio.sfxUiClick(); settingsReturn = "menu"; showScreen("settings"); });
  $("btn-pause-settings").addEventListener("click", () => { audio.sfxUiClick(); settingsReturn = "pause"; showScreen("settings"); });
  $("btn-settings-back").addEventListener("click", () => { audio.sfxUiClick(); showScreen(settingsReturn); });

  $("btn-pause").addEventListener("click", () => {
    audio.sfxUiClick();
    game.pause();
    showScreen("pause");
  });
  $("btn-resume").addEventListener("click", () => {
    audio.sfxUiClick();
    game.resume();
    showScreen(null);
  });
  $("btn-quit").addEventListener("click", () => {
    audio.sfxUiClick();
    game.state = "menu";
    audio.stopMusic();
    setPlayUiVisible(false);
    refreshMenu();
    showScreen("menu");
  });

  $("btn-retry").addEventListener("click", () => { audio.sfxUiClick(); startNewRun(); });
  $("btn-gameover-menu").addEventListener("click", () => {
    audio.sfxUiClick();
    game.state = "menu";
    setPlayUiVisible(false);
    refreshMenu();
    showScreen("menu");
  });

  $("btn-bomb").addEventListener("click", () => game.triggerBomb());

  el.rangeSfx.addEventListener("input", () => {
    const s = loadSave();
    s.settings.sfx = el.rangeSfx.value / 100;
    persist();
    applySettingsToUi(s.settings);
  });
  el.rangeMusic.addEventListener("input", () => {
    const s = loadSave();
    s.settings.music = el.rangeMusic.value / 100;
    persist();
    applySettingsToUi(s.settings);
  });
  el.toggleMute.addEventListener("click", () => {
    const s = loadSave();
    s.settings.muted = !s.settings.muted;
    persist();
    applySettingsToUi(s.settings);
    audio.sfxUiClick();
  });
  el.toggleShake.addEventListener("click", () => {
    const s = loadSave();
    s.settings.shake = !s.settings.shake;
    persist();
    applySettingsToUi(s.settings);
    audio.sfxUiClick();
  });
  el.toggleHaptics.addEventListener("click", () => {
    const s = loadSave();
    s.settings.haptics = !s.settings.haptics;
    persist();
    applySettingsToUi(s.settings);
    audio.sfxUiClick();
  });
  $("btn-reset-progress").addEventListener("click", () => {
    if (!window.confirm("Azzerare punteggio migliore e potenziamenti permanenti?")) return;
    const s = resetProgress();
    applySettingsToUi(s.settings);
    refreshMenu();
    audio.sfxUiClick();
  });

  game.onLevelUp = (choices) => { renderLevelUpCards(choices); showScreen("levelup"); };
  game.onGameOver = (stats) => {
    el.goScore.textContent = stats.score.toLocaleString("it-IT");
    el.goWave.textContent = stats.wave;
    el.goDust.textContent = stats.dust;
    el.goHighscoreRow.classList.toggle("hidden", !stats.isHighScore);
    setPlayUiVisible(false);
    showScreen("gameover");
  };
  game.onWaveToast = (text) => showHint(text, 1700);
  game.onBossIncoming = () => showHint("Attenzione: Boss Stellare in arrivo!", 2400);
  game.onPlayerHit = () => {
    el.hitFlash.classList.remove("flash");
    void el.hitFlash.offsetWidth;
    el.hitFlash.classList.add("flash");
  };

  input.onFirstInput = () => audio.unlockAudio();

  window.addEventListener("resize", () => game.resize());
  window.addEventListener("orientationchange", () => setTimeout(() => game.resize(), 200));

  const initialSave = loadSave();
  applySettingsToUi(initialSave.settings);
  refreshMenu();
  showScreen("menu");
}
