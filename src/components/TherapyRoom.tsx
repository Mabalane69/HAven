import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Users,
  User,
  Heart,
  Sparkles,
  ShieldAlert,
  Info,
  Clock,
  RotateCcw,
} from 'lucide-react';
import type { TherapySession, ChatMessage, UserProfile, TherapyMode } from '../types';
import { api } from '../services/api';

interface TherapyRoomProps {
  user: UserProfile;
  openCrisisModal: () => void;
}

export const TherapyRoom: React.FC<TherapyRoomProps> = ({ user, openCrisisModal }) => {
  const [mode, setMode] = useState<TherapyMode>('INDIVIDUAL');
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [currentSpeaker, setCurrentSpeaker] = useState<'USER' | 'PARTNER'>('USER');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isVoiceOutputEnabled, setIsVoiceOutputEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [currentlySpeakingMsgId, setCurrentlySpeakingMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load therapy sessions
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
      if (data.length > 0) {
        // Select matching mode session
        const matching = data.find((s) => s.mode === mode) || data[0];
        setCurrentSessionId(matching.id);
      }
    } catch (err) {
      console.error('Failed to load therapy sessions:', err);
    }
  };

  // Scroll to bottom on messages change
  const activeSession = sessions.find((s) => s.id === currentSessionId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputMessage(transcript);
      };

      recognizer.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognizer.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognizer;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. You can type freely in the text box below.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Recognition start error:', e);
      }
    }
  };

  // Speech synthesis for therapeutic voice response
  const speakText = (text: string, msgId: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    if (currentlySpeakingMsgId === msgId) {
      setCurrentlySpeakingMsgId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Gentle, measured therapeutic cadence
    utterance.pitch = 1.0;

    // Pick soothing voice if available
    const voices = window.speechSynthesis.getVoices();
    const calmVoice = voices.find(
      (v) => v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google UK English Female') || v.name.includes('Karen')
    );
    if (calmVoice) utterance.voice = calmVoice;

    utterance.onend = () => setCurrentlySpeakingMsgId(null);
    utterance.onerror = () => setCurrentlySpeakingMsgId(null);

    setCurrentlySpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    setInputMessage('');
    setIsLoading(true);
    setErrorBanner(null);

    try {
      const response = await api.sendMessage({
        sessionId: currentSessionId,
        mode,
        message: text,
        sender: mode === 'COUPLE' ? currentSpeaker : 'USER',
      });

      if (response.reply) {
        // Update session in state
        setSessions((prev) => {
          return prev.map((s) => {
            if (s.id === (response.session?.id || currentSessionId)) {
              return {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: `user_${Date.now()}`,
                    sessionId: s.id,
                    sender: mode === 'COUPLE' ? currentSpeaker : 'USER',
                    content: text,
                    timestamp: new Date().toISOString(),
                  },
                  response.reply,
                ],
              };
            }
            return s;
          });
        });

        if (response.isCrisis) {
          openCrisisModal();
        }

        // Auto speak if enabled and not crisis
        if (isVoiceOutputEnabled && !response.isCrisis && response.reply.content) {
          speakText(response.reply.content, response.reply.id);
        }
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setErrorBanner('Failed to deliver message. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const startNewSession = () => {
    const newSession: TherapySession = {
      id: `ses_${Date.now()}`,
      mode,
      userId: user.id,
      title: mode === 'COUPLE' ? 'Couples Attunement Dialogue' : 'Individual Guided Therapy',
      startedAt: new Date().toISOString(),
      messages: [
        {
          id: `msg_init_${Date.now()}`,
          sessionId: `ses_${Date.now()}`,
          sender: 'AI',
          content:
            mode === 'COUPLE'
              ? `Welcome ${user.name} and ${user.partnerName || 'partner'}. This is your emotionally neutral, non-judgmental space. Here, we don't look for who is wrong or right. We look for the tender feelings and unmet attachment needs underneath the reaction. What would you both like to bring to the circle today?`
              : `Hello ${user.name}. Take a moment to settle in and let your shoulders drop. This is your confidential sanctuary where you don't have to carry everything alone. What has been weighing on your mind or body today?`,
          timestamp: new Date().toISOString(),
          sentiment: 'positive',
        },
      ],
    };

    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const suggestedPrompts =
    mode === 'COUPLE'
      ? [
          'Jordan withdrew and I felt rejected and anxious',
          'We had an argument about household chores and it escalated',
          'Help us practice a softened startup without criticism',
          'We feel emotionally disconnected after a stressful week',
        ]
      : [
          "I'm experiencing an anxiety spiral about work expectations",
          'How do I set a boundary with my parents without feeling guilt?',
          'I feel emotionally exhausted and overwhelmed today',
          'Help me reframe the feeling that I am failing everyone',
        ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Clinical Disclaimer & Safety Banner */}
      <div className="p-3.5 bg-stone-100/80 border border-stone-200/80 rounded-xl flex items-center justify-between text-xs text-stone-600 gap-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-stone-500 shrink-0" />
          <span>
            Haven is a supportive therapeutic guide practicing evidence-based CBT & EFT. Not a medical substitute. In emergency, call or text 988.
          </span>
        </div>
        <button
          onClick={openCrisisModal}
          className="text-xs font-semibold text-rose-700 hover:text-rose-800 underline whitespace-nowrap shrink-0"
        >
          View Crisis Lifelines
        </button>
      </div>

      {/* Main Therapy Workspace Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Sidebar: Mode Selector & Recent Sessions */}
        <div className="lg:col-span-1 space-y-5">
          {/* Therapy Mode Switcher */}
          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Therapy Focus</h3>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 rounded-xl">
              <button
                onClick={() => {
                  setMode('INDIVIDUAL');
                  const s = sessions.find((x) => x.mode === 'INDIVIDUAL');
                  if (s) setCurrentSessionId(s.id);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
                  mode === 'INDIVIDUAL'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <User className="w-3.5 h-3.5 text-teal-700" />
                <span>Individual</span>
              </button>

              <button
                onClick={() => {
                  setMode('COUPLE');
                  const s = sessions.find((x) => x.mode === 'COUPLE');
                  if (s) setCurrentSessionId(s.id);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
                  mode === 'COUPLE'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-teal-700" />
                <span>Couples (EFT)</span>
              </button>
            </div>

            {/* Couples partner connection info */}
            {mode === 'COUPLE' && (
              <div className="pt-2 border-t border-stone-100 space-y-2 text-xs text-stone-600">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Partner Linked:</span>
                  <span className="font-semibold text-stone-900">{user.partnerName || 'Jordan Taylor'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Pairing Code:</span>
                  <span className="font-mono text-stone-700">{user.coupleCode || 'HAVEN-8492'}</span>
                </div>
                <div className="p-2.5 bg-teal-50/70 border border-teal-100 rounded-lg text-teal-900 text-[11px] leading-relaxed">
                  Emotionally Focused Therapy rule: Speak from your own tender needs rather than analyzing your partner.
                </div>
              </div>
            )}
          </div>

          {/* Session History List */}
          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Sessions</h3>
              <button
                onClick={startNewSession}
                className="text-xs font-medium text-teal-800 hover:text-teal-900 flex items-center gap-1"
              >
                <span>New Session</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {sessions.map((sess) => (
                <button
                  key={sess.id}
                  onClick={() => {
                    setCurrentSessionId(sess.id);
                    setMode(sess.mode);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors ${
                    sess.id === currentSessionId
                      ? 'bg-stone-100 font-medium text-stone-900 border border-stone-200'
                      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                  }`}
                >
                  <div className="truncate font-semibold">{sess.title}</div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-400">
                    <span>{sess.mode === 'COUPLE' ? 'Couples' : 'Individual'}</span>
                    <span>·</span>
                    <span>{new Date(sess.startedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Main Column: Active Conversation Canvas */}
        <div className="lg:col-span-3 bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[740px]">
          {/* Header of Active Session */}
          <div className="p-4 border-b border-stone-200 bg-stone-50/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-stone-900 font-serif">
                {activeSession?.title || 'Therapeutic Sanctuary Session'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span>Guide: Harmony (AI Clinical Companion)</span>
                <span>·</span>
                <span>Mode: {mode === 'COUPLE' ? 'Emotionally Focused Therapy' : 'CBT & Mindfulness'}</span>
              </div>
            </div>

            {/* Audio Voice Readout Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsVoiceOutputEnabled(!isVoiceOutputEnabled)}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                  isVoiceOutputEnabled
                    ? 'bg-teal-50 border-teal-200 text-teal-800'
                    : 'bg-stone-100 border-stone-200 text-stone-600'
                }`}
                title={isVoiceOutputEnabled ? 'Mute AI Voice Reading' : 'Enable AI Voice Reading'}
              >
                {isVoiceOutputEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-teal-700" />
                    <span className="hidden sm:inline">Voice On</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Muted</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-gradient-to-b from-stone-50/30 to-white">
            {activeSession?.messages.map((msg) => {
              const isAi = msg.sender === 'AI';
              const isPartner = msg.sender === 'PARTNER';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isAi
                      ? 'items-start max-w-2xl'
                      : isPartner
                      ? 'items-end ml-auto max-w-xl'
                      : 'items-end ml-auto max-w-xl'
                  }`}
                >
                  {/* Sender identity & time */}
                  <div className="flex items-center gap-2 text-xs text-stone-400 mb-1 px-1">
                    <span className="font-medium text-stone-700">
                      {isAi
                        ? 'Harmony'
                        : isPartner
                        ? `${user.partnerName || 'Partner (Jordan)'}`
                        : `${user.name} (You)`}
                    </span>
                    <span>·</span>
                    <span className="tabular-nums">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.flagged && (
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Safety Notice
                      </span>
                    )}
                  </div>

                  {/* Message bubble */}
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      isAi
                        ? msg.flagged
                          ? 'bg-rose-50/90 text-rose-950 border border-rose-200'
                          : 'bg-stone-100/90 text-stone-800 border border-stone-200/80 rounded-tl-sm'
                        : isPartner
                        ? 'bg-amber-100 text-stone-900 border border-amber-200 rounded-tr-sm'
                        : 'bg-teal-800 text-white rounded-tr-sm shadow-xs'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.content}</p>

                    {/* Audio replay button for AI messages */}
                    {isAi && (
                      <div className="mt-2.5 pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs text-stone-500">
                        <button
                          onClick={() => speakText(msg.content, msg.id)}
                          className="flex items-center gap-1.5 hover:text-stone-800 transition-colors"
                        >
                          {currentlySpeakingMsgId === msg.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-teal-700 animate-pulse" />
                              <span className="text-teal-700 font-medium">Pause Voice</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Listen Aloud</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 p-3 bg-stone-100/70 border border-stone-200 rounded-xl max-w-xs text-xs text-stone-500">
                <Sparkles className="w-4 h-4 text-teal-700 animate-spin" />
                <span>Harmony is reflecting with care...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error Banner if any */}
          {errorBanner && (
            <div className="py-2 px-4 bg-rose-50 border-t border-rose-200 text-rose-800 text-xs">
              {errorBanner}
            </div>
          )}

          {/* Quick Guided Prompts */}
          <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider shrink-0">
              Suggestions:
            </span>
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                className="px-2.5 py-1 text-xs text-stone-600 bg-white border border-stone-200 rounded-lg hover:border-stone-400 hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input & Voice Controls Footer */}
          <div className="p-4 border-t border-stone-200 bg-white space-y-3">
            {/* Couples Mode: Switch active speaker */}
            {mode === 'COUPLE' && (
              <div className="flex items-center justify-between text-xs pb-1">
                <div className="flex items-center gap-2 text-stone-500">
                  <span>Currently typing as:</span>
                  <div className="flex items-center gap-1 p-0.5 bg-stone-100 rounded-lg">
                    <button
                      onClick={() => setCurrentSpeaker('USER')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        currentSpeaker === 'USER'
                          ? 'bg-teal-800 text-white'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {user.name} (You)
                    </button>
                    <button
                      onClick={() => setCurrentSpeaker('PARTNER')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        currentSpeaker === 'PARTNER'
                          ? 'bg-amber-600 text-white'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {user.partnerName || 'Jordan (Partner)'}
                    </button>
                  </div>
                </div>
                <span className="text-[11px] text-stone-400">Take turns expressing feelings</span>
              </div>
            )}

            {/* Voice Recording Waveform Visualizer Banner */}
            {isRecording && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-900 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                  <span>Listening to your voice... Speak calmly into your microphone.</span>
                </div>
                <button
                  onClick={toggleRecording}
                  className="font-semibold text-rose-700 hover:underline"
                >
                  Done Speaking
                </button>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-3 rounded-xl border transition-colors shrink-0 ${
                  isRecording
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                }`}
                title={isRecording ? 'Stop Voice Recording' : 'Speak via Voice'}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  mode === 'COUPLE'
                    ? `Share what you are feeling as ${currentSpeaker === 'USER' ? user.name : user.partnerName || 'Jordan'}...`
                    : 'Share what you are holding, or ask for guidance...'
                }
                className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-700 focus:bg-white transition-all text-stone-900 placeholder:text-stone-400"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-3 bg-teal-800 text-white rounded-xl hover:bg-teal-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
