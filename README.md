# QuizCraft Plus

QuizCraft Plus is a small interactive quiz practice app that turns AI-generated study content into active learning instead of keeping it as plain text in a chat.

Paste a quiz in JSON format, start practicing, check your answers, and review the questions you missed. When an explanation is not enough, you can open a focused follow-up prompt in ChatGPT or Claude.

Everything runs in the browser. No account, backend, database is needed.

## Features

- Paste quizzes in JSON format
- Practice multiple choice, true/false, and fill-in-the-blank questions
- Check answers during the quiz or at the end
- Shuffle questions and answer options
- Use an optional timer
- Review correct, wrong, skipped, and unanswered questions
- Save quiz progress locally in the browser
- Retry completed quizzes
- Open focused follow-up prompts in ChatGPT or Claude

## Quiz Format

QuizCraft Plus expects a JSON object with a `questions` array.

```json
{
  "questions": []
}
```

Each question should include:

- `id`
- `type`
- `question`
- `answer`
- `explanation`

Supported question types:

- `MCQ` — multiple choice
- `TF` — true/false
- `FILL` — fill in the blank

## Example

```json
{
  "questions": [
    {
      "id": 1,
      "type": "MCQ",
      "question": "Which OSI layer is responsible for routing packets?",
      "options": {
        "A": "Data Link",
        "B": "Network",
        "C": "Transport",
        "D": "Application"
      },
      "answer": "B",
      "explanation": "The Network layer handles routing between networks."
    },
    {
      "id": 2,
      "type": "TF",
      "question": "UDP guarantees reliable delivery.",
      "answer": "FALSE",
      "explanation": "UDP does not guarantee delivery, ordering, or retransmission."
    },
    {
      "id": 3,
      "type": "FILL",
      "fillMode": "typed",
      "question": "TCP stands for ___.",
      "answer": "Transmission Control Protocol",
      "acceptedAnswers": ["Transmission Control Protocol", "TCP"],
      "explanation": "TCP provides reliable data delivery between applications."
    }
  ]
}
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the app:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev
```

Start the development server.

```bash
npm run build
```

Create a production build.

```bash
npm run start
```

Run the production build locally.

```bash
npm run test
```

Run tests.

## Environment Variable

For production, set the site URL:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

Example:

```bash
NEXT_PUBLIC_SITE_URL=https://quizcraft-nine.vercel.app
```

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Vitest

## License

This project is licensed under the MIT License.

See [LICENSE](./LICENSE) for details.
