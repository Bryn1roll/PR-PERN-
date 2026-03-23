## PERN-labs — REST API в Docker

- **Сервис A**: CRUD по ресурсу `tasks` в PostgreSQL, базовая информация о проекте.
- **Сервис B**: CRUD по ресурсу `notes` (in-memory), проксирование данных и отправка/проверка email (SMTP/IMAP/POP3) через GreenMail.

---

### Требования

- Установлен Docker (и `docker compose` / `docker-compose`).


---

### Структура проекта

- `backend/service-a` — сервис A (tasks API)
  - `src/index.js` — код сервиса.
  - `Dockerfile` — образ для сервиса A.
- `backend/service-b` — сервис B (notes API + HTTP-запросы к A)
  - `src/index.js` — код сервиса.
  - `Dockerfile` — образ для сервиса B.
- `db/` — PostgreSQL контейнер и инициализация схемы (`init.sql`).
- `frontend/` — UI ToDo List (React + Router).
- `docker-compose.yml` — поднимает всё в одной сети Docker:
  - `service-a`, `service-b`,
  - `db` (PostgreSQL),
  - `greenmail` (SMTP/IMAP/POP3),
  - `ui` (фронтенд).

---

### Запуск в Docker 

Из корня проекта:

```bash
cd "РАСПОЛОЖЕНИЕПРОЕКТА"

docker compose up --build

```

После успешного старта:

- Сервис A доступен на `http://localhost:3000`
- Сервис B доступен на `http://localhost:4000`
- UI доступен на `http://localhost:5173`
- Почта доступна на `http://localhost:8080/api/user/to@localhost/messages`

Остановить:

```bash
docker compose down
# или docker-compose down
```

---

### Проверка сервисов с помощью curl

<details>
<summary><strong>Показать примеры curl-запросов для сервисов A и B</strong></summary>


#### Сервис A (tasks API)

Базовая проверка:

```bash
curl http://localhost:3000/
curl http://localhost:3000/info
```

CRUD по задачам:

```bash
# Получить все задачи
curl http://localhost:3000/tasks

# Создать новую задачу
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Сделать отчёт по лабораторной","completed":false}'

# Получить задачу по id (пример: id = 1)
curl http://localhost:3000/tasks/1

# Обновить задачу
curl -X PUT http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Обновлённая задача","completed":true}'

# Удалить задачу
curl -X DELETE http://localhost:3000/tasks/1
```

#### Сервис B (notes API + взаимодействие с A)

Базовая проверка:

```bash
curl http://localhost:4000/
```

CRUD по заметкам:

```bash
# Получить все заметки
curl http://localhost:4000/notes

# Создать заметку
curl -X POST http://localhost:4000/notes \
  -H "Content-Type: application/json" \
  -d '{"text":"Заметка для проверки REST","important":true}'

# Получить заметку по id (пример: id = 1)
curl http://localhost:4000/notes/1

# Обновить заметку
curl -X PUT http://localhost:4000/notes/1 \
  -H "Content-Type: application/json" \
  -d '{"text":"Обновлённая заметка","important":false}'

# Удалить заметку
curl -X DELETE http://localhost:4000/notes/1
```

HTTP-взаимодействие: сервис B → сервис A

Базовый пример (B читает данные из A):

```bash
curl http://localhost:4000/proxy/tasks
```

Этот запрос обращается к сервису B, который внутри контейнера делает HTTP-запрос к сервису A (`GET /tasks`) и возвращает объединённый ответ.

##### Сценарий 1: создание задачи в A и чтение её через B

1. **Создаём новую задачу напрямую в сервисе A**:

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Задача, созданная для проверки взаимодействия","completed":false}'
```

2. **Проверяем, что задача появилась в A напрямую**:

```bash
curl http://localhost:3000/tasks
```

3. **Читаем те же данные через сервис B (проксирование)**:

```bash
curl http://localhost:4000/proxy/tasks
```

В отчёте можно показать, что в ответе от `/proxy/tasks` присутствует только что созданная задача — это демонстрация обмена данными по HTTP между двумя сервисами.

Альтернатива: **создать задачу в A через сервис B**, используя `POST /proxy/tasks`:

```bash
curl -X POST http://localhost:4000/proxy/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Задача, созданная через сервис B","completed":false}'
```

В этом случае клиент отправляет запрос только в сервис B, а тот внутри делает `POST /tasks` в сервис A.

##### Сценарий 2: обновление задачи в A и повторное чтение через B

1. **Обновляем задачу в A (пример: id = 2)**:

```bash
curl -X PUT http://localhost:3000/tasks/2 \
  -H "Content-Type: application/json" \
  -d '{"title":"Обновлённая задача из сценария 2","completed":true}'
```

2. **Проверяем обновление в A**:

```bash
curl http://localhost:3000/tasks/2
```

3. **Снова читаем список задач через B**:

```bash
curl http://localhost:4000/proxy/tasks
```

В ответе должны быть новые значения `title` и `completed` — это пример того, что сервис B получает актуальные данные из сервиса A по протоколу HTTP.

##### Сценарий 3: удаление задачи в A и проверка через B

1. **Удаляем задачу в A (пример: id = 2)**:

```bash
curl -X DELETE http://localhost:3000/tasks/2
```

2. **Проверяем текущее состояние задач в A**:

```bash
curl http://localhost:3000/tasks
```

3. **Проверяем состояние данных через B**:

```bash
curl http://localhost:4000/proxy/tasks
```

</details>

<details>
<summary><strong>Показать curl-запросы для отправки и проверки email</strong></summary>

Отправка письма (SMTP) через сервис B:

```bash
curl -X POST http://localhost:4000/email/send \
  -H "Content-Type: application/json" \
  -d '{"taskId":1,"to":"to@localhost"}'
```

Проверка входящей почты через IMAP (количество писем в INBOX):

```bash
curl http://localhost:4000/email/check-imap
```

Проверка входящей почты через POP3 (количество писем):

```bash
curl http://localhost:4000/email/check-pop3
```

Просмотр темы последнего письма в INBOX (IMAP):

```bash
curl http://localhost:4000/email/latest-imap
```

</details>

---

### Интеграция Postman-коллекции

В репозитории есть готовая коллекция Postman: `pern-api-test.postman_collection.json`.

<details>
<summary><strong>Показать шаги по импорту Postman-коллекции</strong></summary>

1. **Откройте Postman**.
2. В левом верхнем углу нажмите **"Import"**.
3. Перейдите на вкладку **"File"**.
4. Нажмите **"Upload Files"** и выберите файл:

   - `pern-api-test.postman_collection.json` из корня проекта.

5. Нажмите **"Import"**.
6. В разделе **"Collections"** появится новая коллекция (например, `PERN API Test`), содержащая:
   - запросы к сервису A (`/tasks`, `/tasks/:id`, `POST/PUT/DELETE /tasks`),
   - запросы к сервису B (`/notes`, `/notes/:id`, `POST/PUT/DELETE /notes`),
  - запросы для HTTP-взаимодействия (`/proxy/tasks`, `POST /proxy/tasks`),
  - запросы для email (`/email/send`, `/email/check-imap`, `/email/check-pop3`).


</details>