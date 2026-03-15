import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FaGithub, FaGitlab } from "react-icons/fa";
import api from "@/api/client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister
        ? { email, password, name }
        : { email, password };
      const { data } = await api.post(endpoint, payload);
      login(data.accessToken, data.user);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = () => {
    window.location.href = "/api/auth/github";
  };

  const handleGitlabLogin = () => {
    window.location.href = "/api/auth/gitlab";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary-500">Runa</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          AI Agentic Agile Team
        </p>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={handleGithubLogin}
          className="cursor-pointer flex-1 flex items-center justify-center gap-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg px-4 py-3 font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
        >
          <FaGithub className="text-xl" />
          GitHub
        </button>
        <button
          onClick={handleGitlabLogin}
          className="cursor-pointer flex-1 flex items-center justify-center gap-2 bg-[#fc6d26] text-white rounded-lg px-4 py-3 font-medium hover:bg-[#e24329] transition-colors"
        >
          <FaGitlab className="text-xl" />
          GitLab
        </button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-600" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
            or
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegister && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer w-full bg-primary-500 text-white rounded-lg px-4 py-3 font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : isRegister ? "Create Account" : "Sign In"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
        {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          onClick={() => setIsRegister(!isRegister)}
          className="cursor-pointer text-primary-500 hover:underline"
        >
          {isRegister ? "Sign in" : "Create one"}
        </button>
      </p>
    </div>
  );
}
