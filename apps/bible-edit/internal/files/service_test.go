package files

import (
	"os"
	"path/filepath"
	"testing"
)

func TestServiceReadWriteAllowlist(t *testing.T) {
	dir := t.TempDir()
	svc := NewService()

	usfmPath := filepath.Join(dir, "GEN.usfm")
	sessionPath := filepath.Join(dir, SessionFileName)
	deniedPath := filepath.Join(dir, "secrets.txt")

	if err := svc.Write(usfmPath, []byte("\\id GEN")); err != nil {
		t.Fatalf("write usfm: %v", err)
	}
	if err := svc.Write(sessionPath, []byte("{}")); err != nil {
		t.Fatalf("write session: %v", err)
	}
	if err := svc.Write(deniedPath, []byte("nope")); err == nil {
		t.Fatal("expected write to denied path to fail")
	}

	raw, err := svc.Read(usfmPath)
	if err != nil || string(raw) != "\\id GEN" {
		t.Fatalf("read usfm: %v (%q)", err, raw)
	}
	if _, err := svc.Read(deniedPath); err == nil {
		t.Fatal("expected read of denied path to fail")
	}

	if _, err := os.Stat(usfmPath); err != nil {
		t.Fatalf("usfm file missing: %v", err)
	}
}
