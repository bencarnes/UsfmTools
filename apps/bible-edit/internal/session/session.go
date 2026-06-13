package session

// RecentFolder is a recently opened USFM folder.
type RecentFolder struct {
	Path  string `json:"path"`
	Label string `json:"label"`
}

// ApplicationSettings mirrors the controls package settings shape.
type ApplicationSettings struct {
	Theme string `json:"theme"`
}

// Data is persisted in BibleEdit_Session.json.
type Data struct {
	CurrentFolder string               `json:"currentFolder"`
	RecentFolders []RecentFolder       `json:"recentFolders"`
	Settings      *ApplicationSettings `json:"settings,omitempty"`
}
