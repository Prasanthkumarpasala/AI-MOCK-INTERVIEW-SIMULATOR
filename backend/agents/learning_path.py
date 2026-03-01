"""
LearningPathAgent — generates a personalized learning path based on interview score and skills.
"""

import json
from core.config import settings


class LearningPathAgent:
    def __init__(self):
        api_key = settings.GROQ_API_KEY.strip()
        if api_key and api_key.startswith("gsk_"):
            try:
                from groq import Groq

                self.client = Groq(api_key=api_key)
                self.enabled = True
            except Exception as e:
                self.enabled = False
                self.client = None
        else:
            self.enabled = False
            self.client = None

    def generate(
        self, scores: dict, skills: str, interview_type: str, improvements: list
    ) -> list:
        """Returns a list of learning path items."""
        if not self.enabled:
            return self._mock_path(skills)

        improvements_text = "\n".join(f"- {item}" for item in improvements)
        prompt = f"""Based on the following interview performance data, create a personalized learning path.

Skills: {skills}
Interview Type: {interview_type}
Overall Score: {scores.get('overall_score', 70)}/100
Technical Score: {scores.get('technical_score', 70)}/100
Communication Score: {scores.get('communication_score', 70)}/100
HR Score: {scores.get('hr_score', 70)}/100

Areas to Improve:
{improvements_text}

Generate a learning path JSON array with 5-7 items. Each item must have this structure:
{{
  "category": "Technical" | "Communication" | "Behavioral",
  "topic": "<specific topic to learn>",
  "description": "<1-2 sentence explanation of why this is important>",
  "resources": ["<resource1>", "<resource2>"],
  "estimated_hours": <number>,
  "priority": "High" | "Medium" | "Low"
}}

Return ONLY the JSON array, no markdown."""

        try:
            completion = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.4,
            )
            raw = completion.choices[0].message.content.strip()
            start = raw.find("[")
            end = raw.rfind("]") + 1
            if start != -1 and end != 0:
                return json.loads(raw[start:end])
        except Exception as e:
            print(f"Learning path error: {e}")
        return self._mock_path(skills)

    def _mock_path(self, skills: str) -> list:
        return [
            {
                "category": "Technical",
                "topic": "Data Structures & Algorithms",
                "description": "Strengthen core CS fundamentals to better answer technical questions.",
                "resources": ["LeetCode", "Cracking the Coding Interview"],
                "estimated_hours": 40,
                "priority": "High",
            },
            {
                "category": "Communication",
                "topic": "STAR Method for Behavioral Answers",
                "description": "Structure answers using Situation, Task, Action, Result to improve clarity.",
                "resources": ["Big Interview", "YouTube: STAR Method tutorial"],
                "estimated_hours": 5,
                "priority": "High",
            },
            {
                "category": "Technical",
                "topic": "System Design Fundamentals",
                "description": "Learn scalable system design concepts essential for senior roles.",
                "resources": [
                    "Grokking the System Design Interview",
                    "System Design Primer (GitHub)",
                ],
                "estimated_hours": 20,
                "priority": "Medium",
            },
            {
                "category": "Behavioral",
                "topic": "Leadership & Conflict Resolution",
                "description": "Develop compelling stories about leadership and handling workplace challenges.",
                "resources": [
                    "Harvard Business Review",
                    "LinkedIn Learning: Leadership Essentials",
                ],
                "estimated_hours": 6,
                "priority": "Medium",
            },
            {
                "category": "Communication",
                "topic": "Technical Communication & Presentation",
                "description": "Improve ability to explain complex technical concepts clearly to non-technical audiences.",
                "resources": ["Toastmasters", "Coursera: Technical Writing"],
                "estimated_hours": 10,
                "priority": "Low",
            },
        ]


learning_path_agent = LearningPathAgent()
