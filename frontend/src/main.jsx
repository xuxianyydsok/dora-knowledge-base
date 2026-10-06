import { render } from 'preact';
import './styles/fonts.css';
import './styles/global.css';
import { App } from './app.jsx';

// 应用入口
render(<App />, document.getElementById('app'));
