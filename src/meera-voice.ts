/** Browser-native voice fallback for the simulator. Production calls use the configured TTS provider. */
async function playAudio(source:string){const audio=new Audio(source);await audio.play();}
async function speak(text:string){
  if(!text)return;
  try{const response=await fetch('http://127.0.0.1:3002/speak',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});if(response.ok){const audio=new Audio(URL.createObjectURL(await response.blob()));audio.onended=()=>URL.revokeObjectURL(audio.src);await audio.play();return;}}catch{/* Browser speech is a development fallback. */}
  if(!('speechSynthesis' in window))return;
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang='en-IN';utterance.rate=.96;utterance.pitch=1.08;
  const indianVoice=window.speechSynthesis.getVoices().find(voice=>/en-IN|hi-IN/i.test(voice.lang));
  if(indianVoice)utterance.voice=indianVoice;
  window.speechSynthesis.speak(utterance);
}
document.addEventListener('click',(event)=>{
  const target=event.target;
  if(!(target instanceof Element))return;
  if(target.closest('.speak'))playAudio('/meera-gemini-sample.wav').catch(()=>speak('Hello Sir, Namaste! Main MSMExpert.com se Meera, AI Assistant bol rahi hoon. Kya main aapke do minute le sakti hoon?'));
  if(target.closest('.compose button'))window.setTimeout(()=>{const replies=document.querySelectorAll('.messages .msg.ai p');const latest=replies.item(replies.length-1)?.textContent||'';speak(latest)},500);
  if(target.closest('.stop')&&'speechSynthesis' in window)window.speechSynthesis.cancel();
});
