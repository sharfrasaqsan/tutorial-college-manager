"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";

declare global {
  interface Window {
    grecaptcha?: {
      render?: (
        container: HTMLElement | string,
        parameters: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark";
          size?: "normal" | "compact";
        }
      ) => number;
      reset?: (opt_widget_id?: number) => void;
      getResponse?: (opt_widget_id?: number) => string;
      ready?: (callback: () => void) => void;
    };
    onGoogleRecaptchaLoad?: () => void;
  }
}

interface ContactFormProps {
  collegeName?: string;
}

export function ContactForm({ collegeName = "Tutorial College" }: ContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("Admissions & Enrollment");
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  // Default to Google's official test site key if no custom key provided
  const siteKey =
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
    "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";

  useEffect(() => {
    let isMounted = true;

    function renderRecaptcha() {
      if (!isMounted || !recaptchaContainerRef.current || !window.grecaptcha?.render) return;
      if (widgetIdRef.current !== null) return;

      try {
        widgetIdRef.current = window.grecaptcha.render(recaptchaContainerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            setCaptchaToken(token);
            setError(null);
          },
          "expired-callback": () => {
            setCaptchaToken("");
          },
          "error-callback": () => {
            setError("Google reCAPTCHA verification error. Please reload the page.");
          },
        });
      } catch (err) {
        console.warn("[reCAPTCHA] Render notice:", err);
      }
    }

    if (window.grecaptcha && window.grecaptcha.render) {
      renderRecaptcha();
    } else {
      window.onGoogleRecaptchaLoad = () => {
        renderRecaptcha();
      };

      if (!document.getElementById("google-recaptcha-script")) {
        const script = document.createElement("script");
        script.id = "google-recaptcha-script";
        script.src =
          "https://www.google.com/recaptcha/api.js?onload=onGoogleRecaptchaLoad&render=explicit";
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [siteKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }
    if (!message.trim() || message.trim().length < 5) {
      setError("Please write a message (at least 5 characters).");
      return;
    }
    if (!captchaToken) {
      setError("Please verify that you are not a robot by checking the CAPTCHA box.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          subject: subject.trim() || undefined,
          message: message.trim(),
          captchaToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send message.");
      }

      setSubmitted(true);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
      setCaptchaToken("");
      if (widgetIdRef.current !== null && window.grecaptcha?.reset) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
    } catch (err: any) {
      setError(err.message || "Unable to send your message. Please try again.");
      if (widgetIdRef.current !== null && window.grecaptcha?.reset) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
      setCaptchaToken("");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSubmitted(false);
    setCaptchaToken("");
    // Give time for DOM to re-render recaptcha container
    setTimeout(() => {
      widgetIdRef.current = null;
      if (recaptchaContainerRef.current && window.grecaptcha?.render) {
        try {
          widgetIdRef.current = window.grecaptcha.render(recaptchaContainerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              setCaptchaToken(token);
              setError(null);
            },
            "expired-callback": () => {
              setCaptchaToken("");
            },
            "error-callback": () => {
              setError("Google reCAPTCHA verification error. Please reload the page.");
            },
          });
        } catch {}
      }
    }, 100);
  }

  if (submitted) {
    return (
      <div className="border border-[#1F5C4D]/30 bg-[#E6F0EC]/60 rounded-[6px] p-6 sm:p-8 text-center animate-in fade-in duration-300">
        <div className="w-12 h-12 rounded-full bg-[#1F5C4D] text-[#FFFFFF] flex items-center justify-center mx-auto mb-3 shadow-xs">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="font-serif text-xl font-semibold text-[#1C1F23] mb-2">
          Message Sent Successfully!
        </h3>
        <p className="text-xs sm:text-sm text-[#5F6670] max-w-md mx-auto leading-relaxed mb-6">
          Thank you for reaching out. Your inquiry has been verified and delivered directly to the administration desk at {collegeName}. We will respond to your email or phone shortly.
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#FFFFFF] border border-[#E4E1DA] text-xs font-medium text-[#1C1F23] hover:bg-[#FAF9F6] transition-colors cursor-pointer"
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-6 sm:p-8 shadow-xs">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F5C4D] uppercase tracking-wider mb-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Direct Inquiries</span>
        </div>
        <h2 className="font-serif text-2xl font-semibold text-[#1C1F23]">
          Send a Message to Administration
        </h2>
        <p className="text-xs text-[#5F6670] mt-1 leading-relaxed">
          Have a question about class schedules, admission requirements, or fees? Submit this form and our academic team will get back to you.
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-[6px] bg-[#FBE9E7] border border-[#A32A2A]/20 flex items-start gap-2.5 text-xs text-[#A32A2A]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name & Email Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="contact-name" className="block text-xs font-medium text-[#1C1F23] mb-1">
              Your Full Name <span className="text-[#A32A2A]">*</span>
            </label>
            <input
              id="contact-name"
              type="text"
              required
              disabled={loading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priyantha Silva"
              className="w-full px-3 py-2 text-xs text-[#1C1F23] bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] focus:outline-hidden focus:border-[#1F5C4D] focus:ring-1 focus:ring-[#1F5C4D] transition-colors disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="contact-email" className="block text-xs font-medium text-[#1C1F23] mb-1">
              Email Address <span className="text-[#A32A2A]">*</span>
            </label>
            <input
              id="contact-email"
              type="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. priyantha@example.com"
              className="w-full px-3 py-2 text-xs text-[#1C1F23] bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] focus:outline-hidden focus:border-[#1F5C4D] focus:ring-1 focus:ring-[#1F5C4D] transition-colors disabled:opacity-60"
            />
          </div>
        </div>

        {/* Phone & Subject Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="contact-phone" className="block text-xs font-medium text-[#1C1F23] mb-1">
              Phone / WhatsApp Number <span className="text-[11px] text-[#5F6670] font-normal">(Optional)</span>
            </label>
            <input
              id="contact-phone"
              type="tel"
              disabled={loading}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 077 123 4567"
              className="w-full px-3 py-2 text-xs text-[#1C1F23] bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] focus:outline-hidden focus:border-[#1F5C4D] focus:ring-1 focus:ring-[#1F5C4D] transition-colors disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="contact-subject" className="block text-xs font-medium text-[#1C1F23] mb-1">
              Inquiry Topic
            </label>
            <select
              id="contact-subject"
              disabled={loading}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs text-[#1C1F23] bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] focus:outline-hidden focus:border-[#1F5C4D] focus:ring-1 focus:ring-[#1F5C4D] transition-colors disabled:opacity-60"
            >
              <option value="Admissions & Enrollment">Admissions &amp; Enrollment</option>
              <option value="Classes & Timetable Inquiry">Classes &amp; Timetable Inquiry</option>
              <option value="Tuition Fees & Payments">Tuition Fees &amp; Payments</option>
              <option value="Teacher Information">Teacher Information</option>
              <option value="General Question">General Question</option>
            </select>
          </div>
        </div>

        {/* Message Area */}
        <div>
          <label htmlFor="contact-message" className="block text-xs font-medium text-[#1C1F23] mb-1">
            Message <span className="text-[#A32A2A]">*</span>
          </label>
          <textarea
            id="contact-message"
            required
            rows={4}
            disabled={loading}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Please detail your question or student grade level..."
            className="w-full px-3 py-2 text-xs text-[#1C1F23] bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] focus:outline-hidden focus:border-[#1F5C4D] focus:ring-1 focus:ring-[#1F5C4D] transition-colors resize-y min-h-[96px] disabled:opacity-60"
          />
        </div>

        {/* Google reCAPTCHA v2 Checkbox Container */}
        <div className="pt-1">
          <label className="block text-xs font-medium text-[#1C1F23] mb-2">
            Spam Protection <span className="text-[#A32A2A]">*</span>
          </label>
          <div
            ref={recaptchaContainerRef}
            className="min-h-[78px] flex items-center"
          />
        </div>

        {/* Submit Button & Assurance */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-[11px] text-[#5F6670]">
            Protected by Google reCAPTCHA. Privacy Policy and Terms of Service apply.
          </span>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[6px] bg-[#1F5C4D] hover:bg-[#17473B] text-xs font-medium text-[#FFFFFF] shadow-sm transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying &amp; Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit Inquiry</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
