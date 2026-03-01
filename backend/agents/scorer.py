"""
ScorerAgent — generates structured scores and feedback from interview transcript.
"""

import json
from core.config import settings


class ScorerAgent:
    def __init__(self):
        api_key = settings.GROQ_API_KEY.strip()
        if api_key and api_key.startswith("gsk_"):
            try:
                from groq import Groq

                self.client = Groq(api_key=api_key)
                self.enabled = True
            except Exception as e:
                print(f"GROQ Scorer Error: {e}")
                self.enabled = False
                self.client = None
        else:
            self.enabled = False
            self.client = None

    def score_interview(
        self, transcript: list, interview_type: str, skills: str
    ) -> dict:
        """
        transcript: list of {"role": "ai"|"user", "content": str}
        Returns a scoring dict.
        """
        if not self.enabled or not transcript:
            return self._mock_score()

        transcript_text = "\n".join(
            [
                f"{'AI Interviewer' if m['role'] == 'ai' else 'Candidate'}: {m['content']}"
                for m in transcript
            ]
        )

        prompt = f"""You are an expert interview evaluator. Analyze the following interview transcript and provide a structured evaluation.

Interview Type: {interview_type}
Candidate Skills: {skills}

TRANSCRIPT:
{transcript_text}

Return a JSON object with EXACTLY this structure (no markdown, pure JSON):
{{
  "overall_score": <0-100 integer>,
  "technical_score": <0-100 integer>,
  "communication_score": <0-100 integer>,
  "hr_score": <0-100 integer>,
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["area1", "area2", "area3"],
  "summary": "<2-3 sentence overall assessment>"
}}

Be strict and honest. Score based on:
- technical_score: depth of technical knowledge, accuracy of answers
- communication_score: clarity, fluency, structure of responses
- hr_score: behavioral responses, professionalism, soft skills
- overall_score: weighted average"""

        try:
            completion = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=600,
                temperature=0.3,
            )
            raw = completion.choices[0].message.content.strip()
            # Extract JSON
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start != -1 and end != 0:
                return json.loads(raw[start:end])
        except Exception as e:
            print(f"Scoring error: {e}")
        return self._mock_score()

    def _mock_score(self) -> dict:
        return {
            "overall_score": 72,
            "technical_score": 68,
            "communication_score": 78,
            "hr_score": 70,
            "strengths": [
                "Good communication skills",
                "Clear project descriptions",
                "Enthusiastic attitude",
            ],
            "improvements": [
                "Deepen technical depth",
                "Provide more quantified examples",
                "Structure answers using STAR method",
            ],
            "summary": "The candidate showed reasonable communication skills and enthusiasm. With more structured, in-depth technical answers and quantified achievements, they can significantly improve their interview performance.",
        }


scorer = ScorerAgent()
