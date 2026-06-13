package files

import "testing"

func TestIsUsfmPath(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		{"/anywhere/GEN.usfm", true},
		{"/anywhere/GEN.USFM", true},
		{"/anywhere/GEN.sfm", true},
		{"/anywhere/GEN.SFM", true},
		{"/anywhere/GEN.txt", false},
		{"/anywhere/BibleEdit_Session.json", false},
	}
	for _, tc := range cases {
		if got := IsUsfmPath(tc.path); got != tc.want {
			t.Fatalf("IsUsfmPath(%q) = %v, want %v", tc.path, got, tc.want)
		}
	}
}

func TestIsSessionPath(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		{"/home/user/BibleEdit_Session.json", true},
		{"/tmp/BibleEdit_Session.json", true},
		{"/tmp/bibleedit_session.json", false},
		{"/tmp/session.json", false},
		{"/tmp/GEN.usfm", false},
	}
	for _, tc := range cases {
		if got := IsSessionPath(tc.path); got != tc.want {
			t.Fatalf("IsSessionPath(%q) = %v, want %v", tc.path, got, tc.want)
		}
	}
}

func TestAllowedForReadWrite(t *testing.T) {
	allowed := []string{
		"/a/GEN.usfm",
		"/b/book.SFM",
		"/c/BibleEdit_Session.json",
	}
	for _, path := range allowed {
		if !AllowedForRead(path) {
			t.Fatalf("AllowedForRead(%q) = false, want true", path)
		}
		if !AllowedForWrite(path) {
			t.Fatalf("AllowedForWrite(%q) = false, want true", path)
		}
	}

	denied := []string{
		"/a/notes.txt",
		"/a/.env",
		"/a/package.json",
		"/a/session.json",
	}
	for _, path := range denied {
		if AllowedForRead(path) {
			t.Fatalf("AllowedForRead(%q) = true, want false", path)
		}
		if AllowedForWrite(path) {
			t.Fatalf("AllowedForWrite(%q) = true, want false", path)
		}
	}
}
