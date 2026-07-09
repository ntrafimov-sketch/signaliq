# SignalIQ — Инструкция по установке

## Что нужно установить

1. **AppMagic MCP** — даёт Claude Desktop доступ к данным AppMagic (доходы, скачивания, рекламу приложений)
2. **Bridge** — локальный сервер, который получает запросы от дашборда и запускает Claude Desktop

---

## Требования

- Mac
- [Claude Desktop](https://claude.ai/download) установлен и залогинен
- Python 3 (`python3 --version` в Terminal должен работать)
- Git (`git --version` в Terminal должен работать)

---

## Шаг 1 — Клонировать репозиторий

```bash
git clone https://github.com/ntrafimov-sketch/signaliq.git
cd signaliq
```

Если репозиторий уже есть на компьютере, просто обнови:

```bash
cd /путь/до/signaliq
git pull origin claude/busy-cerf-G4zAW
```

---

## Шаг 2 — Установить AppMagic MCP

### 2.1 Установить зависимость

```bash
pip3 install mcp
```

### 2.2 Узнать путь к Python

```bash
which python3
```

Скопируй результат (например `/usr/bin/python3` или `/opt/homebrew/bin/python3`).

### 2.3 Открыть конфиг Claude Desktop

В Finder нажми **⌘Shift G** и вставь:
```
~/Library/Application Support/Claude/
```

Открой файл `claude_desktop_config.json` в любом текстовом редакторе (TextEdit, VS Code и т.д.).

### 2.4 Добавить MCP сервер

Найди секцию `"mcpServers"` и добавь новый блок:

```json
"appmagic": {
  "command": "ПУТЬ_К_PYTHON3",
  "args": ["ПУТЬ_К_РЕПОЗИТОРИЮ/servertest.py"]
}
```

**Пример** (замени имя пользователя на своё):
```json
"appmagic": {
  "command": "/opt/homebrew/bin/python3",
  "args": ["/Users/ТВОЁ_ИМЯ/signaliq/servertest.py"]
}
```

Итоговый файл должен выглядеть примерно так:
```json
{
  "mcpServers": {
    "appmagic": {
      "command": "/opt/homebrew/bin/python3",
      "args": ["/Users/ТВОЁ_ИМЯ/signaliq/servertest.py"]
    }
  }
}
```

### 2.5 Перезапустить Claude Desktop

Полностью закрой Claude Desktop (**⌘Q**) и открой снова.

В новом чате должны появиться инструменты AppMagic (иконка молотка).

---

## Шаг 3 — Запустить Bridge

### 3.1 Разрешить Accessibility

Bridge управляет Claude Desktop через AppleScript. При первом запуске нужно дать разрешение:

**System Settings → Privacy & Security → Accessibility** → найти **Terminal** (или iTerm2) → включить переключатель.

### 3.2 Запустить Bridge

Открой Terminal и выполни:

```bash
cd /Users/ТВОЁ_ИМЯ/signaliq && git pull origin claude/busy-cerf-G4zAW && python3 bridge.py
```

Должно появиться:
```
  SignalIQ Bridge running on http://localhost:7337
  Ready — researching will happen in background!
```

### 3.3 Создать алиас (один раз)

Чтобы не печатать длинную команду каждый раз:

```bash
echo "alias bridge='cd /Users/ТВОЁ_ИМЯ/signaliq && git pull origin claude/busy-cerf-G4zAW && python3 bridge.py'" >> ~/.zshrc
source ~/.zshrc
```

После этого достаточно просто писать `bridge` в Terminal.

### 3.4 Проверка

Открой в браузере: `http://localhost:7337/health`

Должно вернуть `{"ok":true}`.

---

## Итог

После всех шагов:
- Claude Desktop имеет доступ к AppMagic данным
- Bridge запущен и дашборд может запускать исследования и генерацию sequences

**Bridge нужно запускать каждый раз перед работой с дашбордом.**
