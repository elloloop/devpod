class Devpod < Formula
  desc "Developer workflow CLI with stacked diffs and local CI"
  homepage "https://github.com/elloloop/devpod"
  version "1.0.0"

  on_macos do
    on_arm do
      url "https://github.com/elloloop/devpod/releases/download/v#{version}/devpod-darwin-arm64"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/elloloop/devpod/releases/download/v#{version}/devpod-darwin-amd64"
      sha256 "PLACEHOLDER"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/elloloop/devpod/releases/download/v#{version}/devpod-linux-arm64"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/elloloop/devpod/releases/download/v#{version}/devpod-linux-amd64"
      sha256 "PLACEHOLDER"
    end
  end

  def install
    binary = Dir["devpod-*"].first || "devpod"
    bin.install binary => "devpod"
  end

  test do
    assert_match "devpod version", shell_output("#{bin}/devpod --version")
  end
end
