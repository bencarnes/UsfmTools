export namespace main {
	
	export class FileEntry {
	    id: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new FileEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	    }
	}
	export class HostInfo {
	    label: string;
	    folderPath: string;
	
	    static createFrom(source: any = {}) {
	        return new HostInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.folderPath = source["folderPath"];
	    }
	}

}

export namespace session {
	
	export class ApplicationSettings {
	    theme: string;
	
	    static createFrom(source: any = {}) {
	        return new ApplicationSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	    }
	}
	export class RecentFolder {
	    path: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new RecentFolder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.label = source["label"];
	    }
	}

}

