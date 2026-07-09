# SignalIQ — Инструкция по установке

Эта инструкция нужна один раз. После настройки достаточно запускать одну команду перед работой.

---

## Что понадобится

- **Mac** (Windows не поддерживается)
- **Claude Desktop** с активной подпиской Pro или Max
- Доступ к интернету

---

## Шаг 1 — Установи Claude Desktop

Если ещё не установлен:

1. Открой [claude.ai/download](https://claude.ai/download)
2. Скачай и установи Claude Desktop
3. Войди в свой аккаунт Anthropic

---

## Шаг 2 — Установи Python 3

1. Открой **Terminal** (нажми **⌘Пробел**, напечатай `Terminal`, Enter)
2. Введи команду и нажми Enter:

```
python3 --version
```

Если видишь `Python 3.x.x` — Python уже есть, переходи к шагу 3.

Если видишь ошибку — в том же окне Terminal введи:

```
xcode-select --install
```

Появится окно — нажми **Install** и дождись завершения (~5 минут).

---

## Шаг 3 — Скачай SignalIQ

В Terminal введи и нажми Enter:

```
cd ~ && git clone https://github.com/ntrafimov-sketch/signaliq.git
```

Подожди пока скачается. Должно появиться что-то вроде:
```
Cloning into 'signaliq'...
done.
```

---

## Шаг 4 — Установи зависимость

```
pip3 install mcp
```

---

## Шаг 5 — Узнай путь к Python

```
which python3
```

Скопируй результат — он понадобится на следующем шаге.
Обычно это `/usr/bin/python3` или `/opt/homebrew/bin/python3`.

---

## Шаг 6 — Настрой AppMagic в Claude Desktop

### 6.1 Открой папку с настройками

В Finder нажми **⌘Shift+G**, вставь этот путь и нажми Enter:

```
~/Library/Application Support/Claude/
```

### 6.2 Открой файл настроек

Найди файл `claude_desktop_config.json` и открой его в TextEdit.

> Если файла нет — создай новый файл с именем `claude_desktop_config.json` в этой папке.

### 6.3 Вставь настройки

Замени **всё содержимое** файла на:

```json
{
  "mcpServers": {
    "appmagic": {
      "command": "СЮДА_ВСТАВЬ_ПУТЬ_К_PYTHON",
      "args": ["/Users/ТВОЁ_ИМЯ/signaliq/servertest.py"]
    }
  }
}
```

Замени два места:
- `СЮДА_ВСТАВЬ_ПУТЬ_К_PYTHON` → результат из шага 5 (например `/opt/homebrew/bin/python3`)
- `ТВОЁ_ИМЯ` → твоё имя пользователя на Mac (посмотри в Terminal: `whoami`)

**Пример готового файла:**
```json
{
  "mcpServers": {
    "appmagic": {
      "command": "/opt/homebrew/bin/python3",
      "args": ["/Users/nikita/signaliq/servertest.py"]
    }
  }
}
```

Сохрани файл (**⌘S**).

### 6.4 Перезапусти Claude Desktop

Закрой Claude Desktop полностью: **⌘Q**.
Открой снова.

В новом чате должна появиться иконка 🔨 (молоток) — это значит AppMagic подключён.

---

## Шаг 7 — Разреши управление компьютером

Bridge управляет Claude Desktop автоматически — для этого нужно дать разрешение один раз.

1. Открой **System Settings** (Системные настройки)
2. Перейди в **Privacy & Security → Accessibility**
3. Найди **Terminal** в списке
4. Включи переключатель рядом с ним

---

## Шаг 8 — Создай быструю команду запуска (один раз)

В Terminal введи (замени `ТВОЁ_ИМЯ` на своё):

```
echo "alias bridge='cd ~/signaliq && git pull origin claude/busy-cerf-G4zAW && python3 bridge.py'" >> ~/.zshrc && source ~/.zshrc
```

Теперь каждый раз для запуска достаточно одного слова.

---

## Каждый раз перед работой с дашбордом

1. Открой **Terminal**
2. Введи:

```
bridge
```

Должно появиться:
```
  SignalIQ Bridge running on http://localhost:7337
  Ready — researching will happen in background!
```

3. **Не закрывай Terminal** — оставь его работать в фоне
4. Открой дашборд в браузере и работай

---

## Проверка что всё работает

Открой в браузере: `http://localhost:7337/health`

Должно вернуть: `{"ok":true}`

---

## Если что-то не работает

| Проблема | Решение |
|---|---|
| `command not found: bridge` | Закрой Terminal, открой новый и попробуй снова |
| `python3: command not found` | Повтори шаг 2 |
| Молотка нет в Claude Desktop | Проверь файл из шага 6, перезапусти Claude Desktop |
| `{"ok":false}` на /health | Bridge не запущен — запусти `bridge` в Terminal |
| Terminal просит разрешение | Разреши в System Settings → Privacy & Security → Accessibility |
