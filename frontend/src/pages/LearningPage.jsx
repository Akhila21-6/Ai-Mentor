import { useState, useRef, useEffect } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import { getAIVideo } from "../service/aiService";
import VideoPlayer from "../components/video/VideoPlayer";
import AITranscript from "../components/video/AITranscript";

import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  VolumeX
  Volume2,
  Maximize,
  Check,
  Circle,
  FileText,
  Search,
  Home,
  BookOpen,
  MessageSquare,
  BarChart3,
  Settings,
  Eye,
  User,
  X,
  Sparkles,
} from "lucide-react";

// Sanitize filename to match backend logic: remove [\\/:*?"<>|], replace spaces with _
function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_");
}

const getYouTubeVideoId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

export default function Learning() {


  const navigate = useNavigate();
  const { id: courseId } = useParams();
  const { user, updateUser } = useAuth();
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed } = useSidebar();
  const [learningData, setLearningData] = useState(null)
  const [expandedModule, setExpandedModule] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [celebritySearch, setCelebritySearch] = useState("");
  const [captions, setCaptions] = useState([]);
  const [activeCaption, setActiveCaption] = useState("");
  const celebrities = ["Salman Khan", "Modi ji", "SRK"];

  const celebrityVideoMap = {
    "Salman Khan": { video: "/videos/salman.mp4", vtt: "/videos/salman.vtt" },
    "Modi ji": { video: "/videos/modi.mp4", vtt: "/videos/modi.vtt" },
    SRK: { video: "/videos/srk.mp4", vtt: "/videos/srk.vtt" },
  };

  const [selectedCelebrity, setSelectedCelebrity] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [aiVideoUrl, setAiVideoUrl] = useState(null);
  const [aiTranscript, setAiTranscript] = useState(null);
  const [isAIVideoLoading, setIsAIVideoLoading] = useState(false);
  const [generatedTextContent, setGeneratedTextContent] = useState("");

  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const transcriptContainerRef = useRef(null);
  const activeCaptionRef = useRef(null);
  const modalRef = useRef(null);
  const lastLessonIdRef = useRef(null);
  const lastCelebrityRef = useRef(null);
  const hasRestoredProgressRef = useRef(false);

  useEffect(() => {
    const fetchLearningData = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`/api/courses/${courseId}/learning`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const courseData = await response.json();
          setLearningData(courseData);
          const findFullLesson = (id) => {
            return courseData.modules
              ?.flatMap(m => m.lessons)
              ?.find(l => l.id === id);
          };
          const userProgress = user?.purchasedCourses?.find(
            (course) => course.courseId === parseInt(courseId)
          )?.progress;

          let initialLesson = null;

          if (userProgress?.currentLesson?.lessonId) {
            initialLesson = findFullLesson(userProgress.currentLesson.lessonId);
          }

          // If no progress or lesson not found, fallback to the course's default currentLesson 
          // or the very first lesson of the first module
          if (!initialLesson) {
            const defaultId = courseData.currentLesson?.id || courseData.modules?.[0]?.lessons?.[0]?.id;
            initialLesson = findFullLesson(defaultId);
          }

          if (initialLesson) {
            courseData.currentLesson = initialLesson;
          }

          setLearningData(courseData);

          if (userProgress) {
            setExpandedModule(userProgress.currentLesson?.moduleTitle || "module-1");
            const currentLesson = userProgress.currentLesson;
            if (currentLesson) {
              const lesson = courseData.modules
                .flatMap((module) => module.lessons)
                .find((l) => l.id === currentLesson.lessonId);
              if (lesson) setLearningData((prev) => ({ ...prev, currentLesson: lesson }));
            }
          }
        } else {
          // Fallback data if API fails
          setLearningData(getFallbackData(courseId));
        }
      } catch (error) {
        setLearningData(getFallbackData(courseId));
      }
    };
    fetchLearningData();
  }, [courseId]);

  const getFallbackData = (courseId) => ({
    course: { id: parseInt(courseId) },
    modules: [
      {
        id: "module-1",
        title: "Module 1",
        lessons: [
          {
            id: 1,
            title: "Introduction to React",
            type: "video",
            duration: "0:10",
            youtubeUrl: "https://www.youtube.com/watch?v=Ke90Tje7VS0",
            content: { introduction: "React is a JavaScript library...", keyConcepts: [] },
          },
        ],
      },
    ],
    currentLesson: {
      id: 1,
      title: "Introduction to React",
      type: "video",
      duration: "0:10",
      youtubeUrl: "https://www.youtube.com/watch?v=Ke90Tje7VS0",
      content: { introduction: "React is a JavaScript library...", keyConcepts: [] },
    },
  });

  useEffect(() => {
    hasRestoredProgressRef.current = false;
  }, [courseId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const generateFromText = (d) => {
      if (!generatedTextContent) return false;
      const sentences = generatedTextContent
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(Boolean);
      if (!sentences.length) return false;
      const timePerSentence = d / sentences.length;
      setCaptions(sentences.map((text, i) => ({
        start: i * timePerSentence,
        end: (i + 1) * timePerSentence,
        text,
      })));
      console.log(`✅ Generated ${sentences.length} captions from AI text`);
      return true;
    };

    const loadVTT = async () => {
      const vttPath = selectedCelebrity ? celebrityVideoMap[selectedCelebrity]?.vtt : null;
      if (!vttPath) { setCaptions([]); return; }
      try {
        const vttPath =
          (selectedCelebrity && celebrityVideoMap[selectedCelebrity]?.vtt) || "/vdo_subtitles.vtt";
        const res = await fetch(vttPath);
        if (!res.ok) return setCaptions([]);
        const text = await res.text();
        const blocks = text.replace(/\r\n/g, "\n").split(/\n\n+/).slice(1);
        const cues = blocks.map((block) => {
          const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
          if (lines.length < 2) return null;
          const match = lines[0].match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
          if (!match) return null;
          const toSeconds = (s) => {
            const [hh, mm, rest] = s.split(":");
            const [ss, ms] = rest.split(".");
            return parseInt(hh) * 3600 + parseInt(mm) * 60 + parseInt(ss) + parseFloat("0." + ms);
          };
          return { start: toSeconds(match[1]), end: toSeconds(match[2]), text: lines.slice(1).join(" ") };
        }).filter(Boolean);
        setCaptions(cues);
      } catch (err) {
        setCaptions([]);
      }
    };
    loadVTT();;
  }, [selectedCelebrity]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !learningData?.currentLesson) return;

    const lessonChanged = lastLessonIdRef.current !== learningData.currentLesson.id;
    const celebrityChanged = lastCelebrityRef.current !== selectedCelebrity;

    if (!lessonChanged && !celebrityChanged && v.src) return;

    lastLessonIdRef.current = learningData.currentLesson.id;
    lastCelebrityRef.current = selectedCelebrity;

    const loadVideo = async () => {
      setCaptions([]);
      setActiveCaption("");

      if (selectedCelebrity) {
        const savedData = user?.purchasedCourses
          ?.find(c => c.courseId === parseInt(courseId))
          ?.progress?.lessonData?.[learningData.currentLesson.id];

        const hasSavedMatchingContent = savedData?.celebrity === selectedCelebrity && savedData?.generatedTextContent;

        if (hasSavedMatchingContent) {
          console.log("♻️ Using saved matching AI content, skipping fetch");
          if (!aiVideoUrl) {
            setGeneratedTextContent(savedData.generatedTextContent);
            setAiVideoUrl(savedData.aiVideoUrl);
          }
          setIsPlaying(false);
          return;
        }

        // Fresh fetch
        setIsAIVideoLoading(true);
        setGeneratedTextContent("");
        setAiVideoUrl(null);

        try {
          const payload = {
            courseId: parseInt(courseId),
            lessonId: learningData.currentLesson.id,
            celebrity: selectedCelebrity.split(" ")[0].toLowerCase(),
            course: learningData?.course?.title || "React JS",
            topic: learningData.currentLesson.title || "Welcome",
          };

          const data = await getAIVideo(payload);
          if (data?.videoUrl) {
            setAiVideoUrl(data.videoUrl);
            v.src = data.videoUrl;
            v.load();
            v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          }
        } catch (error) {
          const src = celebrityVideoMap[selectedCelebrity]?.video || learningData.currentLesson.videoUrl;
          if (src) {
            v.src = src;
            v.load();
            v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          }
        } finally {
          setIsAIVideoLoading(false);
        }

      } else {
        // No celebrity — let VideoPlayer handle src via its useEffect
        setIsAIVideoLoading(false);
        const src = learningData.currentLesson.videoUrl;
        if (src) {
          v.src = src;
          v.load();
          setIsPlaying(false);
        }
      }
    };
    loadVideo();
  }, [learningData?.currentLesson?.id, selectedCelebrity]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isFull);
    };

    const events = [
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
      "MSFullscreenChange"
    ];

    events.forEach(event => document.addEventListener(event, handleFullscreenChange));

    // Support for iOS video element specifically
    const video = videoRef.current;
    if (video) {
      video.addEventListener('webkitbeginfullscreen', () => setIsFullscreen(true));
      video.addEventListener('webkitendfullscreen', () => setIsFullscreen(false));
    }

    return () => {
      events.forEach(event => document.removeEventListener(event, handleFullscreenChange));
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', () => setIsFullscreen(true));
        video.removeEventListener('webkitendfullscreen', () => setIsFullscreen(false));
      }
    };
  }, [videoRef]);




  // ⏳ NEW FEATURE: Auto-save video progress every 10 seconds (BULLETPROOF VERSION)
  // ⏳ NEW FEATURE: Auto-save video progress every 10 seconds (BULLETPROOF VERSION)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!learningData?.currentLesson) return;

      try {
        const token = localStorage.getItem("token");
        let currentSecs = 10;
        let totalSecs = 100;

        if (videoRef.current && typeof videoRef.current.currentTime !== "undefined") {
          currentSecs = videoRef.current.currentTime;
          totalSecs = videoRef.current.duration;
        }

        // 🚨 THE FIX: Prevent 'NaN' from crashing the database! 🚨
        const safeCurrentSecs = isNaN(currentSecs) ? 0 : Math.round(currentSecs);
        const safeTotalSecs = isNaN(totalSecs) ? 100 : Math.round(totalSecs);

        await fetch("/api/history/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: String(user?.id || "1"),
            courseId: String(courseId || "1"),
            lessonId: String(learningData.currentLesson.id || "1"),
            watchedSeconds: safeCurrentSecs,
            totalDuration: safeTotalSecs,
          }),
        });

        console.log(`📡 Progress saved to DB: ${safeCurrentSecs} seconds`);
      } catch (error) {
        console.error("Error saving progress:", error);
      }
    }, 10000); 

    return () => clearInterval(interval);
  }, [learningData?.currentLesson?.id, courseId, user?.id]);

  const { modules, currentLesson } = learningData || {};

  if (!learningData) return <div>Loading...</div>;

  const allLessons = (modules || []).flatMap((module) => module.lessons || []);
  const currentLessonIndex = allLessons.findIndex((lesson) => lesson.id === currentLesson?.id);

  const saveLessonData = async (lessonId, data) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/users/course-progress", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: parseInt(courseId),
          lessonData: {
            lessonId,
            data
          },
          currentLesson: {
            lessonId,
            moduleTitle: modules.find(m => m.id === expandedModule)?.title || ""
          }
        }),
      });
      if (res.ok) {
        const result = await res.json();
        // Update user context to reflect changes
        if (updateUser && result.purchasedCourses) {
          updateUser({ purchasedCourses: result.purchasedCourses });
        }
      }
    } catch (error) {
      console.error("Error saving lesson data:", error);
    }
  };

  const completeLesson = async (lessonId) => {
    // API logic for completing lesson...
  };

  const toggleModule = (id) => setExpandedModule((prev) => (prev === id ? null : id));
  const handleLessonClick = (lesson) => setLearningData((prev) => ({ ...prev, currentLesson: lesson }));
  const handlePrevious = () => { if (currentLessonIndex > 0) handleLessonClick(allLessons[currentLessonIndex - 1]); };
  const handleNext = async () => {
    if (currentLessonIndex >= allLessons.length - 1) return;
    setIsNavigating(true);
    if (currentLesson?.id) await completeLesson(currentLesson.id);
    handleLessonClick(allLessons[currentLessonIndex + 1]);
    setIsNavigating(false);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); } 
      else { videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)); }
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
      if (!isMuted && volume === 0) { setVolume(0.5); videoRef.current.volume = 0.5; }
    }
  };

  const handleProgress = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      const currentTime = videoRef.current.currentTime;
      setDuration(duration);
      setCurrentTime(currentTime);
      setProgress((currentTime / duration) * 100);
      if (captions.length > 0) {
        const cue = captions.find((c) => currentTime >= c.start && currentTime <= c.end);
        setActiveCaption(cue ? cue.text : "");
      }
    }
  };

  const handleSeek = (e) => {
    if (videoRef.current) {
      const rect = e.target.getBoundingClientRect();
      const newTime = ( (e.clientX - rect.left) / rect.width ) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress((newTime / duration) * 100);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { playerContainerRef.current?.requestFullscreen(); setIsFullscreen(true); } 
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };

  const formatTime = (time) => {
    if (time === undefined || time === null || Object.is(time, NaN) || !isFinite(time)) return "0:00";
    const minutes = Math.floor(Math.abs(time) / 60);
    const seconds = Math.floor(Math.abs(time) % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-canvas-alt flex flex-col">
      <Header />

      {/* SIDEBAR */}
      <div className="fixed left-0 top-16 bottom-0 w-80 text-main bg-card border-r border-border overflow-y-auto z-10">
        <div className="p-6 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-main">{learningData?.course?.title || "Course"}</h2>
            <button onClick={() => navigate("/courses")} className="text-muted hover:text-main">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <ChevronRight className="w-4 h-4 text-muted" />
            <button className="hover:text-blue-600 transition-colors" disabled style={{ cursor: 'default', opacity: 1, fontWeight: 600 }}>
              {(() => {
                if (modules && currentLesson) {
                  const mod = modules.find(m => m.lessons?.some(l => l.id === currentLesson.id));
                  return mod?.title || 'Module';
                }
                return 'Module';
              })()}
            </button>
            <ChevronRight className="w-4 h-4 text-muted" />
            <span className="text-main font-medium">{currentLesson?.title}</span>
          </div>
          
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-main mb-3">Celebrities</h3>
            <div className="flex flex-col gap-2">
              {celebrities.map((c) => (
                <button
                  key={c}
                  onClick={() => { setSelectedCelebrity(selectedCelebrity === c ? null : c); }}
                  className={`w-full text-left px-4 py-3 rounded-lg border border-border ${selectedCelebrity === c ? "bg-primary text-white" : "bg-input text-main"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="ml-80 p-6 w-full pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Video Player */}
          <div className="lg:col-span-2 space-y-6">
            <VideoPlayer
              currentLesson={currentLesson}
              aiVideoUrl={aiVideoUrl}
              selectedCelebrity={selectedCelebrity}
              celebrityVideoMap={celebrityVideoMap}
              activeCaption={activeCaption}
              playerContainerRef={playerContainerRef}
              videoRef={videoRef}
              handleProgress={handleProgress}
              getYouTubeVideoId={getYouTubeVideoId}
            />
            
            {/* Custom Controls */}
            <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-4">
                <button onClick={togglePlay} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button onClick={toggleFullscreen} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2 cursor-pointer" onClick={handleSeek}>
                  <div className="bg-blue-600 h-2 rounded-full relative" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={toggleMute} className="text-gray-600">
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input type="range" min="0" max="1" step="0.1" value={volume} onChange={handleVolumeChange} className="w-32 accent-blue-600" />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Syllabus */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg p-4 shadow-sm border border-border h-fit max-h-[85vh] overflow-y-auto sticky top-24">
              <h3 className="text-lg font-bold text-main mb-4 sticky top-0 bg-card py-2 z-10 border-b border-border">
                Course Content
              </h3>
              <div className="space-y-3">
                {(modules || []).map((module) => (
                  <div key={module.id} className="border border-border rounded-lg overflow-hidden">
                    <button onClick={() => toggleModule(module.id)} className="w-full flex items-center justify-between p-4 bg-gray-50">
                      <span className="font-semibold text-sm">{module.title}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedModule === module.id ? "rotate-180" : ""}`} />
                    </button>
                    {expandedModule === module.id && (
                      <div className="bg-white">
                        {module.lessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            onClick={() => handleLessonClick(lesson)}
                            className={`w-full flex items-start gap-3 p-3 border-t border-gray-100 ${currentLesson?.id === lesson.id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""}`}
                          >
                            <Play className={`w-4 h-4 mt-1 ${currentLesson?.id === lesson.id ? "text-blue-600" : "text-gray-400"}`} />
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium">{lesson.title}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}