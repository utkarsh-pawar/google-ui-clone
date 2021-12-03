import React from 'react'
import styles from './Footer.module.css'


const Footer = () => {
    return (
        <div className={styles.footer}>
            <div className={styles['footer-location']}>
                India
            </div>
            <div className={styles['footer-links']}>
                <ul>
                    <li><a href="#">About</a></li>
                    <li><a href="#">Advertising</a></li>
                    <li><a href="#">Business</a></li>
                    <li><a href="#">How Search Works</a></li>
                </ul>
                <ul>
                    <li><a href="#">Privacy</a></li>
                    <li><a href="#">Terms</a></li>
                    <li><a href="#">Settings</a></li>
                </ul>
            </div>
            
        </div>
    )
}

export default Footer
