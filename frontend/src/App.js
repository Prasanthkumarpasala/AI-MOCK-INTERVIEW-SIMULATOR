import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [question, setQuestion] = useState("Step 1: Upload Resume to Begin");
  const [alertStatus, setAlertStatus] = useState("OK");
  const [isListening, setIsListening] = useState(false);
  const [round, setRound] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const roundTracker = useRef(0); 

  useEffect(() => {
    socketRef.current = new WebSocket("ws://localhost:8000/ws/proctor");
    socketRef.current.onmessage = (e) => {
      const status = JSON.parse(e.data).alert;
      setAlertStatus(status);
      if (status !== "OK") {
        new Audio("https://cdn.pixabay.com/audio/2022/03/24/audio_7314781442.mp3").play().catch(()=>{});
      }
    };
    
    const interval = setInterval(() => {
      if (videoRef.current?.readyState === 4 && socketRef.current?.readyState === 1) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        socketRef.current.send(JSON.stringify({ image: canvasRef.current.toDataURL('image/jpeg') }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const processResponse = (data) => {
    setQuestion(data.question);
    setRound(data.round);
    roundTracker.current = data.round; 
    const audio = new Audio(data.audio_url);
    audio.play().catch(e => console.error("Audio Play Error:", e));
  };

  const submitVoiceAnswer = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported in this browser.");

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      
      console.log("Transcribed Text:", transcript);
      console.log("Current Round in Tracker:", roundTracker.current);

      const formData = new FormData();
      formData.append("user_answer", transcript);
      formData.append("round", roundTracker.current);

      try {
        // This is the specific line that was failing to trigger in your logs
        const res = await axios.post("http://localhost:8000/api/chat", formData);
        processResponse(res.data);
      } catch (err) {
        console.error("The POST request failed:", err);
        alert("Failed to send answer. Check console for error.");
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech Error:", event.error);
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px', fontFamily: 'Arial' }}>
      <div style={{ background: alertStatus === 'OK' ? '#2ecc71' : '#e74c3c', color: 'white', padding: '10px', fontWeight: 'bold' }}>
        MALPRACTICE STATUS: {alertStatus}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
        <div style={{ background: '#000', padding: '10px', borderRadius: '15px' }}>
          <video ref={videoRef} autoPlay muted playsInline width="400" style={{ borderRadius: '10px' }} />
          <br/>
          <button onClick={async () => {
            const s = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
            videoRef.current.srcObject = s;
          }} style={{ marginTop: '10px' }}>Activate Camera</button>
        </div>
        <div style={{ width: '450px', border: '1px solid #ddd', padding: '30px', borderRadius: '15px' }}>
          <h3>Interview Question (Round {round})</h3>
          <p style={{ minHeight: '100px', fontSize: '1.1rem' }}>{question}</p>
          {round === 0 ? (
            <input type="file" onChange={async (e) => {
              const d = new FormData();
              d.append("file", e.target.files[0]);
              const res = await axios.post("http://localhost:8000/api/start", d);
              processResponse(res.data);
            }} />
          ) : (
            <button 
              onClick={submitVoiceAnswer} 
              style={{ background: isListening ? '#e74c3c' : '#3498db', color: 'white', padding: '15px 30px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
            >
              {isListening ? "Listening... Speak Now" : "🎤 Click to Answer via Voice"}
            </button>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} width="320" height="240" />
    </div>
  );
}

export default App;