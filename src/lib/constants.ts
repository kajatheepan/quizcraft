// ── CONSTANTS ────────────────────────────────────────────────────────────────

export const DEMO_QUIZ = `{
  "questions": [
    {
      "id": 1,
      "type": "MCQ",
      "question": "Which sublayer of the Data Link Layer is responsible for flow control and error detection?",
      "options": {
        "A": "Physical Layer",
        "B": "LLC (Logical Link Control)",
        "C": "MAC (Media Access Control)",
        "D": "Network Layer"
      },
      "answer": "B",
      "explanation": "The LLC sublayer handles flow control, error detection, and provides a uniform interface to the network layer regardless of the transmission medium."
    },
    {
      "id": 2,
      "type": "FILL",
      "fillMode": "typed",
      "question": "The MAC address is ___ bits long.",
      "answer": "48",
      "acceptedAnswers": ["48", "forty eight", "forty-eight"],
      "explanation": "MAC addresses are 48 bits (6 bytes) long, typically represented as six groups of two hexadecimal digits separated by colons or hyphens."
    },
    {
      "id": 3,
      "type": "TF",
      "question": "CSMA/CD can completely eliminate frame collisions on a network.",
      "answer": "FALSE",
      "explanation": "CSMA/CD detects collisions after they occur and initiates retransmission, but it cannot prevent collisions from happening in the first place."
    },
    {
      "id": 4,
      "type": "MCQ",
      "question": "Which of the following is a characteristic of the Data Link Layer?",
      "options": {
        "A": "Routes packets across multiple networks",
        "B": "Converts data to electrical signals",
        "C": "Provides node-to-node data delivery",
        "D": "Assigns IP addresses to devices"
      },
      "answer": "C",
      "explanation": "The Data Link Layer is responsible for node-to-node delivery of frames between directly connected devices on the same network segment."
    },
    {
      "id": 5,
      "type": "FILL",
      "fillMode": "dragdrop",
      "question": "In CSMA/CD, after a collision is detected, each device waits a random amount of time before retransmitting. The [[1]] algorithm reduces repeated collisions.",
      "blanks": [
        {
          "id": "1",
          "answer": "backoff",
          "acceptedAnswers": ["backoff", "binary exponential backoff"]
        }
      ],
      "choices": ["backoff", "collision", "frame"],
      "explanation": "After detecting a collision, CSMA/CD uses a backoff algorithm to reduce the chance of another immediate collision."
    }
  ]
}`;

export const STORAGE_KEY = "quizcraft";

export const DEFAULT_SETTINGS = {
  shuffle: true,
  shuffleOptions: true,
  explanationTiming: "after" as const,
  timer: false,
  timerSeconds: 30,
};
