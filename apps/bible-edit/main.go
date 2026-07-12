package main

import (
	"context"
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	usfmService := NewUsfmService()

	err := wails.Run(&options.App{
		Title:  "BibleEdit",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			usfmService.startup(ctx)
		},
		OnShutdown: func(ctx context.Context) {
			usfmService.shutdown()
		},
		OnBeforeClose: app.BeforeClose,
		Bind: []interface{}{
			app,
			usfmService,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
