import Ref from 'html-tag-js/Ref';
import plugin from '../plugin.json';
import style from './style.scss';
import defaultPalettes from './defaultPalettes.json';
import { maxKey } from './utils';

const { clipboard } = cordova.plugins;
const appSettings = acode.require('settings');
const { editor } = editorManager;
const fs = acode.require('fs');
const colorPicker = acode.require('colorPicker');
const Color = acode.require('Color');
const Url = acode.require('Url');
const select = acode.require('select');
const prompt = acode.require('prompt');
const confirm = acode.require('confirm');

class ColorPalette {
  /**
   * @type {Object<string, { name: string, colors: object<string, string> }>}
   */
  palettes = defaultPalettes;

  settings = {
    preferredColorFormat: 'hex'
  };

  async init($page) {
    await this.load();

    this.$style = tag('style', { innerHTML: style });
    document.head.append(this.$style);

    this.$page = $page;
    this.$page.id = 'color-palette';
    this.$page.settitle('Color Palette');

    const searchInput = new Ref();
    const addBtn = new Ref();

    const $header = tag('form', {
      className: 'header',
      children: [
        <input
          ref={searchInput}
          className="header__input"
          type="text"
          placeholder="Search palette"
        />,
        <button
          type="submit"
          className="header__search-btn header__btn icon search"
        ></button>,
        <button
          ref={addBtn}
          type="button"
          className="header__add-btn header__btn icon add"
        ></button>
      ]
    });

    searchInput.el.oninput = (e) => {
      if (!e.target.value.trim()) {
        this.renderPalettes();
      }
    };

    $header.onsubmit = (e) => {
      e.preventDefault();
      const searchValue = searchInput.value.trim().toLowerCase();

      if (!searchValue) {
        this.renderPalettes();
        return;
      }

      const filteredPalettes = {};
      Object.entries(this.palettes).forEach(([paletteKey, palette]) => {
        if (palette.name.toLowerCase().includes(searchValue)) {
          filteredPalettes[paletteKey] = palette;
        }
      });

      if (!Object.keys(filteredPalettes).length) {
        this.$palettes.innerHTML = '';
        this.$palettes.append(
          <div className="palettes__no-result">
            No palette named "{searchValue}"
          </div>
        );
      } else {
        this.renderPalettes(filteredPalettes);
      }
    };

    addBtn.el.onclick = async () => {
      const paletteName = await prompt('Create Palette', '', 'text', {
        required: true,
        placeholder: 'Palette name'
      });

      if (paletteName) {
        this.palettes[String(maxKey(this.palettes) + 1)] = {
          name: paletteName,
          colors: {}
        };
        await this.save();
        this.renderPalettes();
      }
    };

    const $palettes = tag('div', {
      className: 'palettes'
    });

    this.$palettes = $palettes;
    this.$page.append($header, $palettes);
    this.show = () => this.$page.show();
    this.hide = () => this.$page.hide();

    this.renderPalettes();
    this.addCommand();
  }

  /**
   * @param {Object<string, { name: string, colors: object<string, string> }>} palettes
   */
  renderPalettes(palettes) {
    if (!palettes) palettes = this.palettes;
    this.$palettes.innerHTML = '';
    Object.entries(palettes).forEach(([paletteKey, palette]) => {
      const $palette = this.createPalette(
        palette.name,
        palette.colors,
        paletteKey
      );
      this.$palettes.append($palette);
    });
  }

  /**
   * @param {string} name
   * @param {Object<string, string>} colors
   * @param {string} paletteKey
   * @returns {HTMLElement}
   */
  createPalette(name, colors, paletteKey) {
    const $palette = tag('div', {
      className: 'palette'
    });

    const $header = tag('div', {
      className: 'palette__header',
      innerText: name
    });

    const $colors = tag('div', {
      className: 'palette__list',
      children: Object.entries(colors).map(([colorKey, color]) => {
        return this.createColor(color, paletteKey, colorKey);
      })
    });

    $colors.prepend(
      tag('div', {
        className: 'palette__options-btn palette__list-item icon edit',
        onclick: async () => {
          const selected = await select('Options', [
            [0, 'Add'],
            [1, 'Rename'],
            [2, 'Reset'],
            [3, 'Delete']
          ]);
          let choice;

          switch (selected) {
            case 0:
              const newColor = await colorPicker();
              const newColorKey = String(maxKey(this.palettes[paletteKey].colors) + 1);
              const $color = this.createColor(
                newColor,
                paletteKey,
                newColorKey
              );

              this.palettes[paletteKey].colors[newColorKey] = newColor;
              $colors.append($color);
              await this.save();
              break;
            case 1:
              const newName = await prompt('Rename Palette', name, 'text', {
                required: true,
                placeholder: name
              });

              if (newName) {
                this.palettes[paletteKey].name = newName;
                $header.innerText = newName;
                name = newName;
                await this.save();
              }
              break;
            case 2:
              choice = await confirm(
                'WARNING',
                'Are you sure you want to reset the palette?'
              );
              if (choice) {
                this.palettes[paletteKey].colors = {};
                $colors
                  .getAll('.palette__list-item:not(.palette__options-btn)')
                  .forEach(($c) => $c.remove());
                await this.save();
              }
              break;
            case 3:
              choice = await confirm(
                'WARNING',
                'Are you sure you want to delete the palette?'
              );
              if (choice) {
                delete this.palettes[paletteKey];
                $palette.remove();
                await this.save();
              }
              break;
          }
        }
      })
    );

    $palette.append($header, $colors);
    return $palette;
  }

  /**
   * @param {string} color
   * @param {string} paletteKey
   * @param {string} colorKey
   * @returns {HTMLElement}
   */
  createColor(color, paletteKey, colorKey) {
    const onclick = () => {
      const encodedColor = new Color(color)[
        this.settings.preferredColorFormat
      ].toString();
      editor.session.insert(editor.getCursorPosition(), encodedColor);
      this.hide();
    };

    let timer;

    const onmouseup = () => {
      if (timer) clearTimeout(timer);
    };

    const onmousedown = (e) => {
      onmouseup();
      timer = setTimeout(async () => {
        navigator.vibrate(30);
        const selected = await select(new Color(color).hex.toString(), [
          [0, 'Copy'],
          [1, 'Change'],
          [2, 'Remove']
        ]);

        if (selected === 0) {
          const encodedColor = new Color(color)[
            this.settings.preferredColorFormat
          ].toString();
          clipboard.copy(encodedColor);
          toast(strings['copied to clipboard']);
        }

        if (selected === 1) {
          const newColor = await colorPicker(color);
          this.palettes[paletteKey].colors[colorKey] = newColor;
          e.target.style.backgroundColor = newColor;
          color = newColor;
          await this.save();
        }

        if (selected === 2) {
          delete this.palettes[paletteKey].colors[colorKey];
          e.target.remove();
          await this.save();
        }
      }, 300);
    };

    return tag('div', {
      className: 'palette__list-item',
      style: {
        backgroundColor: color
      },
      onclick,
      onmousedown,
      onmouseup,
      onmousemove: onmouseup.bind(this),
      ontouchstart: onmousedown.bind(this),
      ontouchend: onmouseup.bind(this),
      ontouchmove: onmouseup.bind(this)
    });
  }

  addCommand() {
    editor.commands.addCommand({
      name: 'Color palette',
      exec: this.show.bind(this)
    });
  }

  syncSettings() {
    if (appSettings.get(plugin.id)) {
      this.settings = appSettings.get(plugin.id);
    } else {
      appSettings.value[plugin.id] = this.settings;
      appSettings.update(undefined, false);
    }
  }

  get initSettings() {
    this.syncSettings();

    const cb = (key, value) => {
      this.settings[key] = value;
      appSettings.value[plugin.id][key] = value;
      appSettings.update();
    };

    const list = [
      {
        key: 'preferredColorFormat',
        text: 'Preferred color format',
        value: this.settings.preferredColorFormat,
        select: ['hex', 'rgb', 'hsl']
      }
    ];

    return { list, cb };
  }

  async load() {
    const palettesFile = await fs(this.PALETTES_FILE_PATH);
    if (await palettesFile.exists()) {
      const palettes = await palettesFile.readFile('json');
      this.palettes = palettes;
    } else {
      await this.save(true);
    }
  }

  async save(firstTime = false) {
    if (firstTime) {
      await fs(Url.dirname(this.PALETTES_FILE_PATH)).createFile(
        'palettes.json',
        JSON.stringify(this.palettes)
      );
    } else {
      await fs(this.PALETTES_FILE_PATH).writeFile(
        JSON.stringify(this.palettes)
      );
    }
  }

  async destroy() {
    editor.commands.removeCommand('Color Palette');
    this.$style.remove();
    delete appSettings.value[plugin.id];
    appSettings.update(undefined, false);
  }
}

if (window.acode) {
  const colorPalette = new ColorPalette();

  acode.setPluginInit(
    plugin.id,
    async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
      baseUrl = Url.join(PLUGIN_DIR, plugin.id);
      colorPalette.PALETTES_FILE_PATH = Url.join(baseUrl, 'palettes.json');
      await colorPalette.init($page, cacheFileUrl, cacheFile);
    },
    colorPalette.initSettings
  );

  acode.setPluginUnmount(plugin.id, () => {
    colorPalette.destroy();
  });
}
